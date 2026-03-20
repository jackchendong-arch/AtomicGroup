# From “Build a Summary App” to “Design the Right Retrieval System”

## Purpose
This document captures the product and engineering journey behind the AtomicGroup recruitment intelligence app. It is intended as source material for a future blog post, not as part of the shipped application.

The story is not only about building an Electron desktop app. It is really about learning how to evaluate:
- what belongs in product spec versus implementation
- when an LLM should generate content directly
- when a template should control structure or presentation
- when RAG helps, and when it is the wrong abstraction

## The Starting Point
The original problem sounded simple:

> Given a candidate CV and a job description, generate a candidate summary that a headhunter can review and send to a hiring manager.

Very quickly, that simple prompt expanded into a real workflow:
- import CV and JD from local files
- extract text from PDF, DOCX, and TXT
- generate a recruiter-facing summary
- let the recruiter edit and approve it
- generate a hiring-manager-facing briefing
- export a Word document using a real business template
- optionally anonymize the output
- eventually hand off to email

That was the first important lesson:

**the user story was not a single generation task. It was a workflow with multiple audiences, multiple output surfaces, and multiple control points.**

## The First Design Mistake to Avoid
The easiest path would have been:
- take CV text
- take JD text
- prompt the LLM
- ask it to generate a final report

That sounds fast, but it mixes too many concerns:
- interpretation
- structure
- presentation
- sharing

Once everything is mixed together, every failure becomes harder to debug:
- Did the model misunderstand the candidate?
- Did the output drift from the expected format?
- Did the briefing become inconsistent with the Word template?
- Did the recruiter summary and hiring-manager output diverge?

So the design had to be decomposed.

## What We Learned About Product Design
The product gradually became clearer once we separated users and outputs.

There are at least two different audiences:

### 1. Recruiter / Headhunter Consultant
This user needs:
- an evaluative summary
- editable draft content
- approval control
- named and anonymous modes
- a working surface for review

This became the `Candidate Summary Review`.

### 2. Hiring Manager
This user needs:
- a clearer and more polished briefing
- a stable format
- exact grounded candidate details
- a document they can read quickly and trust

This became the `Hiring Manager Briefing`, and later the Word document export.

That led to the second important lesson:

**different users need different outputs, even when those outputs come from the same source documents.**

## The Role of the Spec
The spec was not just a requirements document. It became a design pressure test.

A good spec had to answer:
- What is the real workflow?
- What is the source of truth?
- What is reviewable?
- What is editable?
- What is exportable?
- What is deterministic versus model-generated?

Without that level of clarity, implementation would keep collapsing back into:
- “just generate some text”
- “just fill a template”
- “just use RAG”

The spec forced better distinctions:
- recruiter summary versus hiring-manager briefing
- Markdown guidance template versus Word presentation template
- raw source documents versus derived structured model
- named versus anonymous output

## The Key Architecture Shift
The biggest architecture shift was this:

**do not ask the LLM to generate the final Word document.**

Instead:
- let the LLM generate recruiter-facing assessment content
- let the LLM help build a grounded structured briefing model
- let the Word template control only the final layout and presentation

This matters because a Word template is not the same thing as a content template.

### Markdown Template
The recruiter summary template is guidance:
- section structure
- expected tone
- expected phrasing

It should influence generation.

### Word Template
The hiring-manager template is presentation:
- document layout
- branding
- table structure
- field placement

It should influence rendering, not reasoning.

That was another core lesson:

**a template can be either guidance or presentation, and the system design gets cleaner when those two roles are separated.**

## The Early Implementation
The first working version used a pragmatic hybrid model:
- local extraction from CV and JD
- direct prompt-based LLM generation for recruiter summary
- deterministic Word rendering for the hiring-manager document
- rule-based field extraction for profile details

This had real advantages:
- faster to build
- easier to test
- easier to debug Word export failures
- good enough to validate user workflow early

But it also showed weaknesses:
- CV parsing becomes brittle across formats
- employment history is hard to generalize from raw heuristics
- recruiter summary and Word output can drift if they are not based on the same model

This was the point where “just parse and prompt” stopped being enough.

## The RAG Question
One of the most important design questions was:

> Should CVs and JDs be handled with RAG?

The answer turned out to be:

**yes, but only in a scoped way.**

Not all retrieval problems are the same.

### What Not to Do
It would be a mistake to start with:
- one global vector store
- many CVs mixed together
- many JDs mixed together
- long-lived embeddings across candidates and roles

That creates problems immediately:
- stale or irrelevant retrieval
- privacy concerns
- harder debugging
- mixing unrelated contexts

### What Makes More Sense
A better model is:
- one active candidate CV
- one active JD
- one optional Markdown guidance template
- one workspace-scoped temporary source set

In other words:

**RAG should be per workspace, not global.**

The app should:
1. extract the active CV and JD
2. normalize them into section-aware blocks
3. optionally include guidance-template content
4. retrieve relevant blocks only for the current task
5. discard or keep them only as local workspace state

This gives the benefits of retrieval:
- better focus on long documents
- less prompt stuffing
- clearer evidence tracing
- lower hallucination risk

without turning the product into an enterprise document search engine.

## Static Templates vs Dynamic Inputs
This turned into one of the clearest conceptual distinctions in the whole project.

### Static Templates
These change rarely.
They represent:
- structure expectations
- document style
- company formatting

Examples:
- built-in recruiter summary template
- local Markdown guidance template
- hiring-manager Word template

### Dynamic Inputs
These change every time.
They represent:
- candidate CVs
- role JDs
- the actual evidence used for grounding

Because they are dynamic, they should not be treated like stable reusable knowledge assets by default.

This led to a strong design rule:

**templates are reusable design artifacts; CVs and JDs are transient evidence inputs.**

That means:
- templates can be versioned and reused
- CVs and JDs should be handled as current workspace evidence
- retrieval over CV/JD should be ephemeral

## The Structured Briefing Model
Once recruiter summary and hiring-manager briefing were separated, the next question was:

> What should be the shared source of truth?

The answer:

**a grounded structured briefing model**

That model should contain:
- candidate facts
- employment history
- education
- languages
- role title and company
- fit summary
- relevant experience
- matched requirements
- concerns and next step
- evidence references where possible

This model became the bridge between:
- LLM reasoning
- recruiter review
- Word rendering

And that was a major design improvement because it removed drift:
- recruiter summary can still be recruiter-facing
- hiring-manager briefing can still be audience-specific
- Word output can stay deterministic
- all of them can still be tied back to a common grounded structure

## Anonymous Mode Was Another Design Lesson
Anonymous mode initially looked like a simple masking problem.

It was not.

The naive design was:
- generate a normal named draft
- apply regex cleanup later

That works only part of the time.

The better design became:
- keep raw CV/JD source unchanged
- make derived outputs anonymity-aware
- generate anonymous recruiter and briefing outputs from sanitized inputs where possible
- still keep deterministic post-processing as a safety net

This revealed another important principle:

**privacy controls should be designed as part of generation architecture, not only as a post-processing patch.**

## Bilingual Output Added Another Layer of Design
Once Chinese CVs and JDs entered testing, the system design had to become more explicit about what exactly was being generated and what was only being translated.

At first glance, “support English and Chinese” sounds like one feature. It was not. It exposed at least three different problems:
- generation language
- review-surface language
- export and email language

This made an important distinction much clearer:

**changing the assessment language is not the same as rerunning the assessment.**

If a recruiter has already generated and reviewed a draft, switching from English to Chinese should usually not trigger a fresh CV/JD evaluation. That would create avoidable drift:
- wording might change for reasons unrelated to language
- fit emphasis might move
- the recruiter could lose confidence in whether the content itself changed

So the better design became:
- generate the summary and briefing once from CV + JD
- keep those as the current derived outputs
- translate the current derived outputs into the other language when the recruiter switches languages
- keep the raw CV and JD unchanged

That led to another useful product lesson:

**translation should be a deterministic presentation step whenever the underlying assessment has not changed.**

## Translation Is Not the Same as “Just Ask the Model Again”
The first translation implementation used a large structured payload and asked the model to return a full translated draft object.

That failed in a very practical way:
- the payload became too large
- the model occasionally returned malformed JSON
- the UI could look stuck if translation state and visible progress were not handled carefully

This pushed the design toward a more robust translation workflow:
- translate only the fields that actually need language conversion
- preserve the original structured briefing shape and evidence references
- treat translation as a bounded transformation, not as a new reasoning pass
- add a repair/fallback step when the returned JSON is malformed

That reinforced a broader engineering principle:

**LLM-based translation still needs strict contracts, bounded payloads, and recovery paths.**

## UI State Was Part of the Product Logic
The language-switch work also exposed something easy to underestimate: UI state is part of system correctness.

When the recruiter clicked the language toggle multiple times, the interface had to answer clearly:
- is translation running?
- which language is being targeted?
- can the user safely click again?
- is this progress local to one tab or global to the workbench?

That led to two simple but important UX rules:
- busy progress belongs to the shared workbench stage, not buried inside one tab
- controls that would create conflicting concurrent actions should be visibly disabled while the task is running

This was another reminder that:

**workflow clarity is not a cosmetic concern. In LLM products, it directly affects user trust.**

## The Emerging LLM Ops Question
As the application became more capable, another design issue became impossible to ignore:

> how do we explain why a candidate was recommended, with which prompt, against which inputs, using which template or retrieval context?

This did not become an immediate implementation change, but it did become a design requirement.

The lesson was that prompts, templates, and future retrieval inputs cannot be treated as invisible implementation details. They are part of the product’s decision trail.

That is why the design started moving toward:
- versioned prompt artifacts
- app-managed artifact registries
- workspace-scoped source models
- later retrieval manifests and run artifacts

The key insight here was:

**LLM features become product features only when they are governable, explainable, and traceable.**

## Keeping the Story Current
Another practical learning from the build process was documentation discipline.

If story capture happens only at the end of the project, most of the useful design reasoning is lost:
- why a decision was made
- which dead ends were rejected
- what changed after user testing
- what the real lessons were behind a commit

So `story.md` should be kept as a live narrative input during development, especially at commit checkpoints.

That does not mean turning every commit into a diary entry. It means capturing:
- what we learned
- what changed in the design model
- which tradeoff became clearer
- what future blog-worthy insight emerged

This is useful because:
- the blog can be written later from real development artifacts
- design reasoning remains anchored to actual implementation work
- the product story becomes traceable instead of reconstructed from memory

## What the UI Taught Us
A lot of the product learning did not come from backend logic. It came from the UI.

The app became much better when the interface clarified:
- source intake
- recruiter summary
- hiring-manager briefing
- CV view
- JD view
- settings

The UI got cleaner once we reduced:
- duplicated titles
- excessive status chips
- oversized buttons
- mixed action and status patterns

This reinforced a practical truth:

**good product architecture usually becomes visible in the interface.**

When the interface is confusing, it often means the mental model underneath is still confused.

## The Most Important Design Takeaways

### 1. Separate surfaces by audience
Recruiter review and hiring-manager output should not be treated as the same artifact.

### 2. Separate reasoning from rendering
LLMs should reason over content.
Templates should control presentation.

### 3. Do not use RAG as a default buzzword
For changing CVs and JDs, scoped retrieval is useful.
A giant global retrieval store is not the right starting point.

### 4. Dynamic evidence and static templates need different handling
CVs and JDs are transient evidence inputs.
Templates are reusable design artifacts.

### 5. Introduce a structured source of truth early
A grounded structured briefing model makes review, export, and validation much more stable.

### 6. Privacy needs architectural treatment
Anonymous mode should be considered in generation design, not only after the fact.

### 7. Spec work is not overhead
The spec was what made the architecture coherent enough to build incrementally.

## A Practical Architecture Summary
The final recommended direction is:

### Source Handling
- locally extract CV and JD
- normalize into section-aware source blocks
- keep them inside a workspace-scoped corpus

### Retrieval
- use retrieval only within the current workspace
- include active CV, active JD, and optional Markdown guidance template
- avoid global cross-candidate retrieval by default

### Recruiter Summary
- use an LLM
- drive structure from a Markdown guidance template
- optimize for recruiter review and editing

### Structured Briefing
- build a grounded structured model from CV and JD
- validate required fields and evidence quality

### Hiring Manager Briefing
- compose it from recruiter-reviewed summary plus grounded structured facts

### Word Output
- render deterministically through a configured Word template
- create the `.docx` only when explicitly exporting or sending

## Suggested Blog Angles
This story could become several different blog posts.

### Option 1
**What Building a Recruitment Intelligence App Taught Me About Product Specs**

Focus:
- why implementation kept changing until the spec became clearer

### Option 2
**RAG Is Not a Default: Choosing the Right Retrieval Design for CVs and Job Descriptions**

Focus:
- why dynamic inputs require workspace-scoped retrieval, not a giant shared vector store

### Option 3
**Templates Are Not All the Same: Separating LLM Guidance from Document Presentation**

Focus:
- Markdown guidance templates versus Word presentation templates

### Option 4
**Why We Stopped Asking the LLM to Generate the Final Document**

Focus:
- deterministic rendering versus generative formatting

## Draft Blog Outline

### Title
From LLM Output to Real Workflow: Designing a Recruitment Intelligence App That Recruiters Can Actually Use

### Opening
Describe the original problem and why it looked much simpler than it really was.

### Section 1
Why generating “a summary” was not the real problem.

### Section 2
How recruiter and hiring-manager outputs became separate product surfaces.

### Section 3
Why templates had to be split into Markdown guidance and Word presentation.

### Section 4
Why direct prompt stuffing works first, but does not scale well for messy real CVs.

### Section 5
When RAG is useful for dynamic documents, and why global retrieval would have been the wrong choice.

### Section 6
How a grounded structured briefing model became the center of the system.

### Section 7
What anonymous mode taught us about privacy-aware generation.

### Closing
Summarize the broader lesson:

> good AI product design is not about adding an LLM to a workflow; it is about deciding what should be generated, what should be structured, what should be deterministic, and what should remain under human control.

## Final Reflection
The most useful outcome of this project so far is not only the software. It is the design discipline it forced:
- define the workflow before optimizing the prompt
- define the source of truth before filling templates
- define audience-specific outputs before designing the UI
- define the retrieval boundary before saying “use RAG”

That is probably the real story worth publishing.
