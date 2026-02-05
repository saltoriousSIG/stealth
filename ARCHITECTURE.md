# Jarvis Architecture

A guide to understanding how this codebase works.

## The Big Picture

```
User Input → CLI → Orchestrator → (Skill or Direct Response) → Output
```

Jarvis is a **skill-based AI assistant**. The orchestrator decides what to do with your request, then either responds directly or delegates to a specialized skill.

## Core Concepts

### 1. The Orchestrator (`src/orchestrator.ts`)

The brain of the system. When you send a message:

1. Loads your identity files (SOUL.md, BRAIN.md, IMPERATIVE.md)
2. Sees what skills are available
3. Asks the AI model: "Should I handle this myself, or delegate to a skill?"
4. Either responds directly or calls the appropriate skill

Think of it as a **dispatcher** that routes requests to the right handler.

### 2. Skills (`skills/*/SKILL.md`)

Self-contained capabilities defined in markdown. Each skill has:

- **Triggers**: Keywords that suggest this skill should handle the request
- **Tools**: What actions the skill can take (read files, run shell, etc.)
- **Model**: Which AI model powers this skill
- **Execution Pattern**: Step-by-step instructions for the skill

Example skills:
- `code` - Writing and editing code
- `shell` - Running terminal commands
- `files` - File operations
- `research` - Web searches and fetching pages

### 3. Providers (`src/providers/`)

How we talk to AI models. Two options:

| Provider | Use Case | Config Key |
|----------|----------|------------|
| **OpenRouter** | Cloud models (Claude, GPT, etc.) | `OPENROUTER_API_KEY` |
| **Ollama** | Local models (Llama, Qwen, etc.) | `OLLAMA_HOST` |

### 4. Tools (`src/tools/`)

Actions the AI can take. Built-in tools:
- `readFile`, `writeFile`, `listFiles` - File operations
- `executeShell` - Run terminal commands
- `callModel` - Ask another AI model

Skills can also define custom tools in `skills/*/tools.ts`.

## File Map

```
jarvis/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── orchestrator.ts   # Main decision maker
│   ├── skill-loader.ts   # Finds and parses skills
│   ├── skill-executor.ts # Runs a skill
│   ├── config.ts         # Configuration system
│   ├── memory.ts         # Conversation history
│   ├── types.ts          # TypeScript types
│   ├── providers/
│   │   ├── index.ts      # Provider factory
│   │   ├── openrouter.ts # Cloud models
│   │   └── ollama.ts     # Local models
│   └── tools/
│       ├── index.ts      # Tool registry
│       ├── files.ts      # File tools
│       ├── shell.ts      # Shell tool
│       └── models.ts     # Model calling tool
├── skills/
│   ├── code/SKILL.md     # Code writing skill
│   ├── shell/SKILL.md    # Shell execution skill
│   ├── files/SKILL.md    # File management skill
│   └── research/         # Web research skill
│       ├── SKILL.md
│       └── tools.ts      # Custom tools (webSearch, fetchPage)
├── templates/            # Identity file templates
│   ├── SOUL.md           # Personality
│   ├── BRAIN.md          # Knowledge/memory
│   └── IMPERATIVE.md     # Core principles
├── config.yaml           # Runtime configuration
└── .env                  # API keys (create from .env.example)
```

## How Requests Flow

```
1. You type: "create a hello.txt file"
                    ↓
2. CLI (index.ts) receives input
                    ↓
3. Orchestrator loads identity + skills
                    ↓
4. Orchestrator asks its model:
   "Given these skills [code, shell, files, research],
    should I delegate or respond directly?"
                    ↓
5. Model decides: "Delegate to 'files' skill"
                    ↓
6. SkillExecutor runs 'files' skill:
   - Loads skill's model (e.g., local-fast → qwen3:14b)
   - Gives it tools: readFile, writeFile, listFiles
   - Skill calls writeFile("hello.txt", "Hello!")
                    ↓
7. Response returned to user
```

## Configuration

### Model Configuration (`config.yaml`)

```yaml
models:
  orchestrator:              # Name you reference
    provider: openrouter     # openrouter or ollama
    model: anthropic/claude-sonnet-4

  local-fast:               # Another named model
    provider: ollama
    model: qwen3:14b

  local-code:
    provider: ollama
    model: qwen2.5-coder:7b
```

### Skill Model Assignment

Skills can specify their model in SKILL.md:

```markdown
## Model
Uses: local-code
```

This references the `local-code` entry in config.yaml.

### Resolution Priority

1. **SKILL.md** `Uses:` line (highest priority)
2. **config.yaml** skill-specific setting
3. **Default**: `local-fast`

### Environment Variables

Set in `.env` (copy from `.env.example`):

```bash
OPENROUTER_API_KEY=your-key-here
OLLAMA_HOST=http://localhost:11434
TAVILY_API_KEY=optional-for-research
```

Variables are interpolated in config.yaml with `${VAR_NAME}` syntax.

## Adding a New Skill

1. Create `skills/myskill/SKILL.md`:

```markdown
# My Skill

Does something useful.

## Triggers
- keyword1
- keyword2

## Model
Uses: local-fast

## Tools
- readFile
- writeFile

## Execution Pattern
1. Understand what the user wants
2. Use tools to accomplish the task
3. Report what was done
```

2. Optionally add `skills/myskill/tools.ts` for custom tools:

```typescript
import { z } from 'zod';

export const myCustomTool = {
  description: 'Does a custom thing',
  parameters: z.object({
    input: z.string().describe('The input')
  }),
  execute: async ({ input }) => {
    // Do something
    return { result: 'done' };
  }
};
```

3. The skill is automatically discovered on next run.

## Key Design Decisions

### Why Markdown for Skills?

- Easy to read and edit
- No code changes needed to add/modify skills
- Clear separation of concerns

### Why Two Providers?

- **Ollama**: Free, private, works offline, good for simple tasks
- **OpenRouter**: Access to frontier models when needed

### Why an Orchestrator Pattern?

- Single entry point for all requests
- Can route to specialized skills based on context
- Skills stay focused and simple

## Common Modifications

### Change the orchestrator model

Edit `config.yaml`:
```yaml
models:
  orchestrator:
    provider: ollama
    model: llama3.1:70b
```

### Add a new tool to all skills

Add to `src/tools/index.ts`, then list it in skill SKILL.md files.

### Customize personality

Edit `templates/SOUL.md` or create your own identity files.

## Debugging Tips

1. **Skill not loading?** Check SKILL.md format matches expected patterns
2. **Wrong model?** Check config.yaml model names match SKILL.md `Uses:` line
3. **Tool not working?** Verify it's listed in the skill's `## Tools` section
4. **API errors?** Check `.env` has correct keys and Ollama is running
