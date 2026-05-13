# Tech Content Style Guide

The rules below set standards for the README, tutorial, and tweet copy in this repository, ensuring consistency, clarity, and accuracy for a global developer audience.

These rules mirror the upstream [midnight-apps/Style.md](https://github.com/midnight-network/midnight-apps/blob/main/Style.md). When in doubt, defer to the upstream version.

---

## 1. Core principles — the TL;DR

- **Clarity over cleverness.** Use simple, direct language. The goal is to transfer information, not to sound smart.
- **Developer-first.** Respect the reader's time. Get to the point. Structure content for scannability.
- **Precision and accuracy.** Every parameter, command, and description must be correct.
- **Empowering and approachable.** Encourage building. Be a guide, not a gatekeeper.

---

## 2. Tone

| We are…                  | We are not…                |
|--------------------------|----------------------------|
| Direct and concise       | Vague, verbose, academic   |
| Authoritative, confident | Arrogant, elitist, dogmatic|
| Helpful, empowering      | Patronising, hand-holding  |
| Technical, precise       | Jargony, overly casual, salesy |
| Modern, innovative       | Hyped, unprofessional      |

**Good:** *"Compile the contract before starting the dev server."*
**Bad:** *"In order to proceed, it is necessitated that the contract be compiled prior to initiation of the dev server."*
**Bad:** *"Unleash the power of your revolutionary dApps with one-click contract compilation!"*

---

## 3. Language

### 3.1. Voice and tense

- **Active voice.** *"Install the Lace wallet extension."* Not *"The Lace wallet extension should be installed."*
- **Present tense.** *"The network rejects blocks with an invalid signature."* Not *"will reject."*

### 3.2. Addressing the reader

- Use **you**, never *the user*.
- Never use **we** when referring to the Midnight network. The network has no agency. Use **we** only for the authoring team.

### 3.3. Word choice

Prefer simple, specific verbs.

| Use              | Avoid                                 |
|------------------|---------------------------------------|
| Allowlist        | Whitelist                             |
| Blocklist        | Blacklist                             |
| Primary/secondary| Master/slave                          |
| Users            | Guys                                  |

### 3.4. Link text

| Use                                | Avoid       |
|------------------------------------|-------------|
| Download the Midnight SDK          | Click here  |
| View the complete API reference    | Read more   |

---

## 4. Formatting

- **Headings:** sentence case. *"Set up your development environment"*, not *"Set Up Your Development Environment"*.
- **Lists:**
  - Numbered for sequential steps.
  - Bulleted for unordered items.
- **Code:** fenced blocks with a language hint. Always paste real, runnable code. No pseudo-code without saying so.
- **Inline code:** for filenames, identifiers, env vars, and short shell commands. `useWalletStore`, `npm run dev`, `INDEXER_HTTP`.
- **Punctuation:** Oxford comma. Single space after periods.
- **Numbers:** spell out one through nine; use digits for 10+.

---

## 5. Code examples

- Code snippets in tutorials must match the source files in the same folder. If you edit the contract, edit the snippet.
- Strip irrelevant context. Show the line that matters.
- Comment **why**, not **what**. Variable names should tell the reader the *what*.
- Type signatures matter — keep TypeScript types in the snippets so readers can hover them in a real editor.

---

## 6. Tutorial structure

Each `tutorial.md` in this repository follows the same shape:

1. **Header** — title, source-code link, target audience.
2. **Why** — the real-world problem in 2–3 paragraphs.
3. **Prerequisites** — exact versions, exact commands.
4. **The contract** — explain the privacy primitives before the code.
5. **The frontend** — wallet integration, provider bundle, page-by-page walkthrough.
6. **End-to-end flow** — numbered steps from deploy → final action.
7. **Extensions** — three concrete ideas a reader could ship next.
8. **Troubleshooting** — a table of error → cause → fix.

Skip none of these. If a section is short, that's fine; if it's missing, the reader gets lost.

---

## 7. Naming

- **dApps:** kebab-case folder, sentence-case title. `confidential-real-estate` → "Confidential Real Estate".
- **Compact contracts:** always `contracts/Contract.compact`. Identifiers in `camelCase`. Public ledger names start with a noun (`ownershipCommitments`, not `commitments_owners`).
- **TypeScript:** `camelCase` for variables/functions, `PascalCase` for components/types, `SCREAMING_SNAKE_CASE` for true constants only.

---

## 8. Tweet copy

Each project's `TWEET.md` should be:

- Under 280 characters per tweet
- Lead with a verb ("Built", "Shipped", "Launched")
- One emoji max, never decorative
- Always credit `@MidnightNtwrk`
- Hashtags at the end: `#midnightfordevs` is mandatory, two more domain-relevant ones optional

Bad: "🚀🚀 Just dropped my AMAZING new on-chain real-estate dApp!!! 💎🙌"
Good: "Just shipped a confidential tokenized real-estate dApp on @MidnightNtwrk 🏢"
