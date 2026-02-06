# Shell

## Description
Execute shell commands and control the machine. This is the agent's primary interface to the operating system.

## Instructions
1. Understand what the user is trying to accomplish
2. Construct the appropriate command(s)
3. Execute and capture output
4. Parse results and report clearly
5. Chain commands if multi-step operations are needed
6. **ALWAYS end with a text summary** of what you ran, what happened, and the key output. Never stop after just making a tool call — the orchestrator needs your summary to understand what occurred.

## Usage
Use for anything that involves the OS: running programs, installing packages, managing processes, file system operations beyond basic read/write, networking, Docker, git, system monitoring, automation scripts.

## Technical Implementation
Uses exec to run shell commands with configurable timeout and working directory. Commands run via the system shell. Can chain multiple commands, pipe output, and handle exit codes.

## References
