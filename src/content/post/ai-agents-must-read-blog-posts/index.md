---
title: "Must-read blog posts about AI agents"
description: "Personal notes and key insights drawn from several blog posts about AI agents."
publishDate: "21 Sep 2025"
updatedDate: "21 Sep 2025"
tags: ["agents", "gen-ai"]
draft: false
---

# Don’t Build Multi-Agents

[Don’t Build Multi-Agents](https://cognition.ai/blog/dont-build-multi-agents#principles-of-context-engineering)

Read date: 21 Sep 2025

The Cognition team doesn’t argue that multi-agent systems are “bad,” but rather that they tend to be ineffective when sub-agents run in parallel without proper coordination.
That’s where the main issues arise: each agent can make decisions misaligned with the others, leading to an inconsistent final result.

That’s why they highlight two core principles:

1. The full context should be shared across all agents, so they don’t work “blind.”

2. Sequential coordination is much more effective than disordered parallelism.

But here’s an important point: they don’t recommend multi-agents by default. Their central thesis is that context engineering—structuring and maintaining context clearly and effectively—is usually more powerful than multiplying agents. In many cases, a single well-designed agent with strong context handling will do the job as well or even better.

When a multi-agent setup does make sense, they propose running sub-agents sequentially. And if the task requires long runtimes, they suggest adding an LLM to summarize the context along the way, so that later agents can operate with a condensed and coherent view of the conversation.

In short:

- Multi-agents are not the enemy, but uncontrolled parallelism is.

- What matters isn’t the number of agents, but the quality of the context.

- Start simple: one agent with strong context. Scale to multi-agent only when strictly necessary.