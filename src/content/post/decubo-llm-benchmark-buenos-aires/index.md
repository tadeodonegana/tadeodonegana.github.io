---
title: "DECUBO: a Buenos Aires culture benchmark for LLMs"
description: "We built a benchmark of 68 questions over 21 Buenos Aires literary texts to measure whether LLMs actually understand culturally situated Spanish."
publishDate: "13 Aug 2026"
tags: ["nlp", "benchmarks", "gen-ai"]
draft: true
---

> **This is old work.** The paper is dated **16 November 2024**, written for our NLP course at the University of Palermo. The models we evaluated — GPT-4, Claude 2.1, Llama 3, Mistral 7B — were current at the time and are now several generations behind. I am publishing it in 2026 because the *method* turned out to age better than the numbers, for reasons I get into at the end.

Back in university, for our NLP course, two classmates and I built a small benchmark called **DECUBO** — *Diminuta Evaluación Cultural Bonaerense*. The idea was simple to state and annoying to pull off: measure how well large language models understand literary texts rooted in the province of Buenos Aires, where getting the answer right depends on knowing the place, not just the language.

The paper was never published anywhere, so I am hosting it here: **[read the full paper (PDF, in Spanish)](/decubo.pdf)**.

It was written with [Lautaro D. Barceló](https://www.linkedin.com/in/lautaro-barcelo/) and Tadeo Wassner Penko, and it would not exist without the Dirección Provincial de Bibliotecas y Promoción de la Lectura. More on that below, because their part was the hard part.

## Why bother

Every serious LLM benchmark is anglocentric. That is not a complaint about anyone's intentions, it is just where the work happened. The problem is what teams do about it: most non-English benchmarks are the English ones run through a translation tool and then executed in the target language.

Translation preserves the words. It does not preserve what the words are doing.

There is a useful distinction here between *language-agnostic* tasks and *language-specific* ones. Mathematical reasoning is language-agnostic — the model tends to do better in English regardless of who is asking. But understanding a social code, a regional joke, or a geographic reference is language-specific, and there the best performance comes from operating in the language the context actually lives in.

The gap shows up in the numbers vendors publish themselves. On MMLU, GPT-4 scored 85.5% in English and 84.0% in Spanish, but 71.8% in Thai and 62.0% in Telugu. Spanish looks fine — until you ask what kind of Spanish, and about what.

That last part is what we wanted to poke at. Common sense is not universal; it is learned, and it is local. Red wedding dresses are the norm in some countries and unthinkable in others. Bringing a gift when you visit someone is obvious in some places and slightly odd in others. A model trained mostly on one culture's data inherits that culture's defaults and quietly applies them everywhere.

Buenos Aires is a reasonable place to test this. It is Argentina's most populous province, Argentina is one of the countries where tools like ChatGPT spread fastest, and the region has a literary tradition dense with the exact things that break a decontextualised reading: Rioplatense idioms, historical references, and places that are narrative constructions as much as physical ones.

## The corpus

We did not pick the texts. That was deliberate.

We handed corpus selection to the Dirección Provincial de Bibliotecas y Promoción de la Lectura, the provincial body responsible for libraries and reading promotion. They chose 21 texts tied to the region, across genres — essay, chronicle, poetry, criticism, short story, travel diary, novel fragments. Borges and Bioy, Roberto Arlt, Haroldo Conti, Rodolfo Walsh, Sara Gallardo, César Aira, Ricardo Piglia, Leila Guerriero, and others.

Delegating this had a consequence we did not fully anticipate. Most benchmarks start from a bias you want to measure and then build a corpus to measure it. We started from a corpus chosen for its cultural and literary merit, and had to work out what it could measure.

That inverted order pushed us toward analysing five dimensions at once — geographic-cultural, linguistic, sociocultural, contextual comprehension, and cultural knowledge — rather than one clean axis. Partly this was principled: those dimensions genuinely overlap in real text, and pretending otherwise would have been artificial. Partly it was practical: digitising the texts with the library was expensive in time, and discarding material for not fitting a single category would have been wasteful. There were not enough questions in any one dimension to be statistically meaningful on its own.

## Writing the questions

68 multiple-choice questions, built in two passes.

**First pass, automated.** We used OpenAI's o1 to generate an initial bank, with a structured prompt specifying the kinds of comprehension we wanted covered — local vocabulary, idioms, geographic references, historical and cultural context.

We knew a model generating questions it can then answer is circular. That was not the point. The point was to see what a model *attends to* in these texts, which turned out to be a decent first map of where the blind spots were.

**Second pass, human.** Specialists from the Dirección went through everything and rewrote it. They did not just clean up the questions, they made them harder. Around 20% were thrown out entirely and written from scratch, because the model's versions missed what mattered.

The most instructive edit was tiny. One question asks what a gaucho means by "Se la juego" — roughly, "I'll take that bet." The model's original distractors included *"that he bets money on a card game"* and *"that he threatens Albarracín with violence."*

The curated version cut the specifics: *"that he bets all his money"* and *"that he threatens violence."*

Removing "card game" and the name makes the wrong answers *better*. Stripped of detail, betting money becomes a plausible reading of "jugársela" for anyone who does not know the idiom, and a generic threat resonates with the stereotype of the confrontational gaucho. The distractors stop testing reading comprehension and start testing whether the model is reasoning from the text or from a cliché about the text.

Not every generated question survived. One asked what a police officer's use of "Tranquilx" implies — the "x" being an inclusive-language marker — and the model's own correct answer was that it reflects the adoption of inclusive language in contemporary Argentine society. Technically true, and it misses the joke completely: the point is how improbable a Buenos Aires cop saying "x" out loud is.

## Running it

We replicated MMLU's CSV layout — text and question in one column, four option columns, one answer column — and wrote a Python script to run the dataset against each model through Amazon Bedrock. We picked models in common use in the region, favouring ones with some free access route.

The whole project ran on a **$20 budget**, which shaped a couple of decisions further down.

## Results

| model | accuracy | questions |
|---|---|---|
| GPT-4 | **93.10%** | 58 |
| Llama 3 70B | **91.18%** | 68 |
| Claude 2.1 | 72.06% | 68 |
| Mistral 7B | 70.59% | 68 |
| Llama 3 8B | 66.18% | 68 |

Two things need explaining before reading too much into that table.

GPT-4 hit its token limit on 10 questions — the prompts include full literary texts, some of them long. We excluded those rather than count them as wrong, which took it from 79.41% to 93.10%. It is the honest adjustment, but it means GPT-4 is scored on 58 questions and everyone else on 68, and the two numbers are not strictly comparable.

We also imputed three questions that were malformed in the dataset, treating them as correctly answered after checking manually that the corrected versions were. With a $20 budget we could not re-run everything.

The shape is clear anyway: a sharp split between the two large models above 90% and everything else below 73%.

The more interesting result is the **error correlation between models**, which is low across the board — and lowest for GPT-4, between 0.07 and 0.10 against every other model. They are not failing on the same questions. Each one has its own holes in cultural understanding, which suggests that averaging a few models together would not save you, and that a benchmark built against one model's weaknesses will not transfer.

## Where they broke

The aggregate numbers are less interesting than the specific failures.

**A city of 600,000.** One question quotes a chronicle by Martín Zariello about a Peligrosos Gorriones concert, where a pogo of about thirty people happens in a city of 600,000. Which city?

The answer is Mar del Plata — Zariello's home town, and it had 593,337 inhabitants when the piece was written. La Plata is the trap: it is the band's home town, and it has 772,618 people. GPT-4 and Llama 3 70B both took the bait. Mistral, of all models, got it right.

Following up outside the benchmark, we found Claude Sonnet 3.5 would default to "La Plata" for anything about the band, but merely mentioning Mar del Plata in a prompt was enough to make it associate the band with Mar del Plata instead. The city in the context window overrode what it knew.

**A river.** Another question asks which river Patagones sits on. The correct answer is the Río Negro. The Arlt text it accompanies is titled *"La tragedia de un padre que va a Mar del Plata"* — Mar del Plata, repeated, nowhere near Patagones. Three of five models answered "Río de la Plata". Only GPT-4 got it right.

**A joke about literacy.** The hardest one is a Borges and Bioy piece where two illiterate gauchos argue about whether a word can be written. One scratches marks in the dirt with a knife, and an old man looks down and pronounces: *"Clarito, trara."*

The question asks what to infer about the old man. The intended answer is that he is just as illiterate as the others and is faking comprehension. Claude 2.1 and Llama 3 70B both chose "he can read and confirms it is written correctly."

That one is not really about Buenos Aires. It is about knowing that Borges and Bioy are being funny, and that the compilers of that anthology attributed the story to a source that may not exist — a habit of theirs that deliberately blurs the line between the real and the invented. You cannot get it from the text alone.

## The part that aged well: unverifiable domains

Writing this up in 2026, the thing that strikes me is that we spent months on a problem the field has since given a name.

Reinforcement learning with verifiable rewards works because some domains come with a checker. Maths has an answer key. Code has a test suite. You can generate a reward signal automatically, at scale, without a human in the loop. Everything that has worked spectacularly well in the last two years leans on that property.

Literary comprehension has no checker. There is no function that takes "did the model understand that Borges is being funny" and returns a scalar. Neither does taste, tone, cultural fit, or most of what people actually want out of these systems. Those are the **unverifiable domains**, and extending training and evaluation into them is one of the live problems right now.

We did not have this vocabulary in 2024. We just had a practical obstacle: how do you grade cultural understanding without arguing about it forever? Our answer was to make the domain verifiable by force. Take a text with no ground truth, have human experts write questions where one answer is unambiguous or clearly dominant, and hand-build distractors adversarial enough that a model reasoning from a cliché picks the wrong one.

Two recent papers are doing recognisable versions of this:

- **[A Simple Trick to Synthesize Unlimited RLVR Tasks from Unverifiable Internet Text](https://huggingface.co/papers/2601.22975)** (Acuna et al., 2026) converts unverifiable text into RLVR training tasks by masking crucial reasoning steps and generating plausible distractors around them — explicitly to unlock "reasoning-rich unverifiable corpora typically excluded from prior RLVR data construction." They also found the multiple-choice framing was load-bearing: open-ended versions let models ignore the task and solve from scratch.

- **[Rubrics as Rewards: Reinforcement Learning Beyond Verifiable Domains](https://arxiv.org/abs/2507.17746)** (Gunjal et al.) goes the other way, keeping the domain unverifiable and replacing the binary checker with structured expert rubrics — for tasks needing "nuanced, multi-criteria judgments rather than binary correctness."

The first one is essentially DECUBO's pipeline, automated. We did that step by hand, with librarians instead of a generator, and the expensive part was exactly the part that is hard to automate: knowing that removing the words "card game" from a wrong answer makes it a much better distractor, because of what "jugársela" means to someone from the Río de la Plata and what it might mean to someone reading it cold.

I would not claim we anticipated anything. A course project with a $20 budget is not ahead of a field. But it does suggest the bottleneck is stable: when you leave the domains with answer keys, the quality of your evaluation collapses into the quality of the humans who wrote the distractors — and those humans need to know the culture, not just the language. That is the part that does not scale, and it is why "just translate the benchmark" fails in a way that is invisible from the aggregate score.

## What I'd do differently

The corpus is small, the question set is smaller, and the budget was $20. None of that is defensible as a serious evaluation; it was a course project. If I picked this up again I would want many more questions per dimension, and I would want the token-limit problem solved properly instead of adjusted around.

What I think holds up is the method: hand corpus selection to people who know the culture, use a model to draft questions and a human expert to make them adversarial, and pay attention to error correlation rather than just leaderboard position.

The thing I keep coming back to is that these failures are invisible if you only look at the aggregate. A model at 91% looks fine until you notice it confidently placed a band in the wrong city because the right city appeared in its training data more often.

## Credits

The benchmark was built by **Lautaro D. Barceló**, **Tadeo Donegana Braunschweig** and **Tadeo Wassner Penko**.

The corpus and the question curation came from the **Dirección Provincial de Bibliotecas y Promoción de la Lectura**, under **Ximena Talento**. **Martín E. Graziano** put his encyclopedic knowledge of the province's writers behind every question we put to the models. Thanks also to **Oscar Jalil** and **Palmira**.

The full paper, in Spanish, is [here](/decubo.pdf).
