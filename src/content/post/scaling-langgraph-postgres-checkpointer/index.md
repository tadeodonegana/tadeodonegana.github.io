---
title: "Scaling LangGraph's Postgres Checkpointer in Production"
description: "How we tamed the growth of LangGraph's checkpoint tables at Tiendanube with custom TTL, cold storage, and the right level of abstraction."
publishDate: "28 Apr 2026"
tags: ["agents", "langgraph", "langchain", "postgres", "checkpointer", "gen-ai"]
draft: true
---

In this blog post I'm going to walk through how we work with the LangGraph Postgres Checkpointer inside Tiendanube, and the improvements we built to make checkpoint persistence more efficient and scalable.

<!-- IMAGE PLACEHOLDER: hero image — checkpointer / Postgres / LangGraph -->

## Why do we need a checkpointer?

Before explaining why we need a checkpointer, let's understand what it is. As an analogy, a checkpointer is like an automatic "save game" mechanism for agents: it records the full state of the process at every important step.

This unlocks a lot of interesting capabilities, like human-in-the-loop, which lets us pause the agent at key points, review what a person did, and resume from exactly where it left off without losing context. Another key feature it opens the door to is time travel: you query the history of "saved games", travel to a past moment, change something, and continue forward creating a new branch. Ideal for "branching" from a point and changing the future behavior.

At Tiendanube we developed an agentic solution that allows e-commerce management in a conversational way — a copilot so our merchants can perform operations easily inside the admin panel by communicating purely in natural language. The multi-agent system that powers this product under the hood is built entirely on LangGraph, the low-level framework developed by LangChain for building agents.

This agentic product requires certain capabilities that we can only get by using LangGraph's checkpoint system: the ones mentioned above (HITL, time travel, etc.) and, of course, long-term memory for the agent, where we persist every interaction. That's why we decided to move forward with this functionality. The decision to use Postgres came from the fact that we already had a Postgres database instance running alongside our service, and alternatives like Redis weren't viable for storing checkpoints since we use Valkey as the internal alternative, and it doesn't have a checkpointer saver implemented (yet).

## The problem

Once we had LangGraph Postgres Checkpointer in place, we were happy — but we started to notice that the growth of the tables holding checkpoints became unbounded as productive user traffic grew. Being able to control the growth of records in the database is critical for our team, since we process more than 120,000 conversations per week and the tables wouldn't stop growing.

To put the problem in numbers: an average conversation, using our multi-agent system and the level of abstraction defined for checkpoints, generates around 93 records across the four tables (`checkpoint_blobs`, `checkpoint_writes`, `checkpoints` and `checkpoint_migrations`) that LangGraph Checkpointer exposes. These records are produced after two messages and three tool calls, which we consider an average conversation flow.

After a week of testing in a staging environment with controlled traffic, the `checkpoint_blobs` table grew up to 56 MB with almost 18,000 records. You can imagine (or infer) the growth seen in production with nearly 120,000 weekly conversations.

<!-- IMAGE PLACEHOLDER: chart of checkpoint table growth over time -->

With a recurring purge or a time-to-live per conversation this could be managed easily, but LangGraph Postgres Checkpointer in its OSS version doesn't offer this mechanism out of the box. The TTL feature is available in LangGraph Platform (cloud or self-hosted) by configuring `checkpointer.ttl` in the `langgraph.json` file, and some checkpointers like Redis and DynamoDB also offer native TTL. Postgres, on top of that, doesn't have a native TTL either, which complicates the problem. The LangChain team itself suggests in [this GitHub issue](https://github.com/langchain-ai/langgraphjs/issues/1138) (from the LangGraphJS repo, but the same concept applies) that teams who need it should implement a time-to-live mechanism in-house.

Having described the problem above, one thing was clear: the tables were going to need to be deleted or sent to a "cold" storage system periodically to avoid unbounded growth. So we built the following mechanisms to work more efficiently with the checkpointer, both for storage and for other concerns around using the package in production environments.

From a software engineering point of view, letting the operational tables of a database grow indefinitely is not a sustainable practice. In high-traffic systems, the volume of records directly impacts maintainability and performance: read and write operations become more expensive, indexes grow, and backup and replication processes need more resources.

> "Operative databases should store operational state, not historical exhaust."

For this reason, many production systems implement data lifecycle management policies, where data is classified by its usage: "hot" data (recent and frequently queried), "warm" data, and historical or "cold" data. The first stays in the operational database, while the others are usually archived in cheaper storage systems.

In our case, checkpoints represent transient system state, useful for executing the agent and for recent debugging, but with a value that decreases over time. Keeping them indefinitely in the operational database introduced unnecessary storage costs and operational complexity. For that reason we concluded it was necessary to implement an explicit retention and archival mechanism that would limit table growth without losing the ability to perform historical analysis on conversations.

## Our solutions

### Creating the checkpointer tables from the CI/CD process

One of our first changes to the standard flow of using LangGraph Postgres Checkpointer was creating the `checkpoint_blobs`, `checkpoint_writes`, `checkpoint_migrations` and `checkpoints` tables inside our service's CI/CD process. We had to do this because every table in our database is created and updated through Alembic migrations that we define ourselves. To stay consistent with that adopted standard procedure, we had to skip the `setup()` method of LangGraph Postgres Checkpointer and pull the migration code from `libs/checkpoint-postgres/langgraph/checkpoint/postgres/base.py` to build a single migration that handles table creation and the eventual downgrade process, if needed.

Even though this was a minimal change, I'm describing it here because it can be useful for several teams running this package in production, especially those with an already standardized CI/CD process.

To track migration updates, we monitor changes to the `libs/checkpoint-postgres/langgraph/checkpoint/postgres/base.py` file in the public LangGraph repository on GitHub. That way we get alerted whenever a modification ships in a new release, so we can update our migrations accordingly to keep compatibility.

<!-- IMAGE PLACEHOLDER: diagram of the CI/CD migration flow -->

### Deleting and cold-storing checkpoints

The main change we introduced into our workflow with LangGraph Postgres Checkpointer was the recurring deletion of checkpointer records from the `checkpoint_blobs`, `checkpoint_writes` and `checkpoints` tables. To do this we built a cron job that runs `DELETE` queries on the tables, removing checkpoints older than X amount of time — a traditional TTL mechanism. For this we use a master table called `conversations`, where we store `created_at` and `updated_at` timestamps for each session. That lets us filter by date and run the `DELETE` queries only against the matching records.

The deletion runs on isolated database partitions, since we use partman to partition our tables by `thread_id` so we can run delete operations without touching the production partition, avoiding table locks and keeping our agent always live in production.

On top of the deletion, every week we run an ETL process that pulls the latest conversations from the database and ships them to an S3 bucket for cold storage, for historical and analytical purposes. Before landing in the S3 bucket, the conversations go through a transformation and cleanup process where `HumanMessage`, `AIMessage` and `ToolMessage` are extracted into a JSON file along with essential metadata such as timestamps and the conversation title.

<!-- IMAGE PLACEHOLDER: ETL pipeline diagram (Postgres → transform → S3) -->

This long-term storage turned out to be very useful for running analytics on conversations and getting more accurate data about our users' interactions, all of it without depending on an external storage service like LangSmith, which under our plan only stores traces for 14 days. This represents a sizable order-of-magnitude saving.

In a conversation with @vtrivedy10, from the LangChain team, I found out that LangSmith offers an [in-house solution to export traces to S3 and other destinations](https://docs.langchain.com/langsmith/data-export). In our case it's not possible to use this approach due to security standards, so the in-house solution was the path forward.

## Learnings: managing the checkpointer's level of abstraction is critical

If we had to highlight a single learning from this whole migration, it would be this: not every agent in a multi-agent system needs a checkpointer, and understanding where to apply it is what defines the sustainability of the architecture.

In this product, the checkpointer is compiled only into the supervisor's graph — the graph that orchestrates the conversational loop, decides which specialist to hand off to, and consolidates the final response. The internal specialists (catalog, navigator, orders, stats) run as sub-graphs invoked from the supervisor's tool calls, and they don't persist their intermediate state in the checkpointer. Only the structured result of each specialist reaches the supervisor's state and gets persisted. This decision dramatically reduces the volume of records generated per conversation.

<!-- IMAGE PLACEHOLDER: supervisor + specialists architecture diagram -->

The criteria we use to decide where to apply the checkpointer boils down to three questions, which we recommend asking before compiling any graph with a saver:

1. **Do I need to pause the execution of this graph?** If the graph has no human-in-the-loop points or `interrupt()` calls, the checkpointer may not be necessary.

2. **Do I need time travel at this level of granularity?** Time travel on the supervisor lets you "rewind" the conversation to a previous turn.

3. **Does my system tolerate sub-graphs being stateless between invocations?** If each specialist can rebuild its context from the input the supervisor passes, there's no reason to checkpoint it. If, on the other hand, the specialist has internal memory that survives across calls, then yes.

Applying this criterion is what allowed us to bring the number of records per conversation down to manageable levels without losing any of the functionality that motivated us to bring in a checkpointer in the first place.

## Conclusions

Our changes around recurring deletion and warm/cold storage of conversations gave us controlled growth of the `checkpoint_blobs`, `checkpoint_writes` and `checkpoints` tables inside our infrastructure. On top of that, warm storage lets us pull extremely interesting metrics about how our users behave with respect to our agentic architecture, giving us key insights to polish details and deliver a better experience over time.

With the historical conversations we run user behavior analysis, grouping them by similar behaviors, detecting issues, and using that data to decide which features to build next. These days Polly, from LangSmith, is also a big help for this — but we'll talk about that in detail in another post.

## Appendix

### A brief explanation of what each LangGraph Postgres Checkpointer table stores

**`checkpoint_migrations`**: Internal version-control table for the checkpointer. Records which version of the LangGraph schema is applied. Important to keep compatibility when updating the package version.

**`checkpoints`**: Main table that stores the full graph state in JSONB format. Contains `channel_values` (primitive values like strings, integers, floats and booleans), `channel_versions` (version control for each channel), and execution metadata. The `parent_checkpoint_id` field maintains the chronological order of the checkpoints and is what enables time-travel by navigating backwards through the execution history.

**`checkpoint_blobs`**: Stores complex (non-primitive) channel values, versioned and stored separately. LangGraph optimizes storage: primitive values (`str`, `int`, `float`, `bool`, `None`) are saved inline in the `checkpoints` table, while complex objects (such as message lists, tool outputs, data structures) are stored here. Each new checkpoint only saves the values that changed, significantly optimizing space usage.

**`checkpoint_writes`**: Stores the pending writes of each superstep. Its main purpose is fault tolerance: when a node fails during the execution of a superstep, LangGraph preserves here the outputs of the nodes that did complete successfully. This makes it possible to resume execution without re-running already completed work, avoiding duplicated calls to LLMs or expensive tools.

## Filesystems and StateBackend

These days we're also integrating a filesystem into our agentic architecture, and to do that we're exploring the [StateBackend](https://reference.langchain.com/python/deepagents/backends/state/StateBackend) that LangChain offers through its deepagents package. This backend uses the graph's state as the filesystem, and as a consequence everything ends up persisted in the checkpointer.

We're still exploring this solution, but no doubt much of what's discussed above will be influenced by this experimental change.

<!-- IMAGE PLACEHOLDER: deepagents StateBackend overview -->
