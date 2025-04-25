---
title: "Building Effective Agents: My notes on Anthropic's Post"
description: "Personal notes and key insights drawn from Anthropic's influential post on designing effective agents."
publishDate: "16 Feb 2025"
updatedDate: "16 Feb 2025"
tags: ["agents", "anthropic", "gen-ai"]
draft: false
---

Anthropic’s [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) post shares, in my honest opinion, some of the most important insights when building agents. Usually, I find myself re-reading and referring back to this blog post in order to recommend it to someone new or to find new ideas and guidelines.

Below are some of my personal notes on the points that I find important, worth remembering, and that I try to apply when building agents in my day-to-day job.

## Workflows vs. Agents

Workflows and agents serve distinct purposes in system design. Workflows operate on fixed, predefined paths, making them ideal for tasks where every step is known in advance. Agents, however, are designed to determine their own course of action, adapting dynamically based on feedback from their environment. This distinction is crucial when deciding the approach for a given problem.

Using agents when you don't need to is like using a Ferrari to go to the grocery store. It's not that you can't do it, but you're just making things more complicated than they need to be.

Below you can find an image from [Langchain's documentation](https://langchain-ai.github.io/langgraph/tutorials/workflows/) that nicely illustrates the difference between workflows and agents:

![@Workflows vs. Agents](./agent_workflow.png "Workflows vs. Agents")

## Simplicity is the ultimate sophistication

When starting a new project, simplicity is your best friend. Rely on direct LLM API calls and straightforward implementations rather than diving into complex frameworks. This minimizes unnecessary layers of abstraction, reduces debugging challenges, and allows you to scale complexity only as the task demands it.

I have fallen into the trap of over-engineering my systems in the past. It's easy to do, especially when you're excited about a new technology or idea. But it's important to remember that simplicity is key to building effective, cheap, and scalable agents. Sometimes some API calls are all you need.

## Transparency Matters

Clear visibility into an agent’s decision-making process is a must. By explicitly showing planning steps and tool usage, you not only make the system easier to debug, but also empower users to understand how conclusions are reached. Transparency is key, and it's a must-have for any agent. Pay special attention to how to show, compare, and store reasoning traces.

Recently I came across a YC-backed startup that is building a tool for showing decision path visualizations, failure modes, and performance—from single runs to thousands of simulations. It's called [Lucidic](https://www.ycombinator.com/launches/Mn7-lucidic-analytics-and-testing-platform-for-rapid-agent-iteration) and I believe it is a great example of a product that will enhance the development process of agents, specifically focusing on transparency and traceability.

## Robust ACI

A well-designed Agent-Computer Interface (ACI) forms the backbone of an effective agent system. Detailed tool documentation and clear instructions ensure that interactions between the agent and external systems are smooth and error-resistant. Use [MCP](https://www.anthropic.com/news/model-context-protocol) when possible.

A quote I really like from the post is:

> Put yourself in the model's shoes. Is it obvious how to use this tool, based on the description and parameters, or would you need to think carefully about it?

This is a great question to ask yourself when building agents.

## Combine, conquer, repeat

Every problem is unique, and a one-size-fits-all solution rarely delivers optimal results. Try combining workflows and agents to create a system that is perfectly aligned with the specific requirements of your application. Try different patterns and take the time to think about the best approach for your case. Do not try to jump into coding a common or already known pattern at first. This is the system design process for agents.

## A rule of thumb

For well-defined, linear tasks, workflows provide predictability and clarity. On the other hand, agents excel at tackling open-ended challenges where the steps aren’t clear upfront. Always remember this.

This note is similar to the first one, but I regularly see people using agents for everything just because they are cool.

## Feedback Loops

The last point is the one where I have the least experience using it. Incorporating feedback loops is essential for continuous improvement. Use automated checkpoints or human oversight. Feedback mechanisms allow the agent to adjust its actions based on performance data. This iterative refinement process is key to maintaining long-term effectiveness.

I would like to end the post with what I honestly believe is the most important point of the post:

> Success in the LLM space isn't about building the most sophisticated system. It's about building the right system for your needs.
