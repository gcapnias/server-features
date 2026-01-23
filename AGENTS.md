# AGENTS.md

## Planning Mode Protocols

* **Skill Prioritization:** Whenever the agent is in **Planning Mode**, it must prioritize the use of the `documentation-lookup` skill before proposing an architecture or implementation strategy.
* **Objective:** Ensure all technical recommendations are grounded in the latest documentation to minimize hallucinations and technical debt.
* **Trigger:** If the user request involves "how-to," "architecture," "setup," or "integration," initiate `documentation-lookup` for the relevant libraries/frameworks involved.
