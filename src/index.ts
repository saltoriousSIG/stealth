import 'dotenv/config';
import { createInterface, Interface } from 'readline';
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { open } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getOrchestrator } from './orchestrator.js';
import { loadConversation, saveConversation, clearConversation } from './memory.js';

const TEMPLATES_DIR = join(process.cwd(), 'templates');
const MEMORY_DIR = join(process.cwd(), 'memory');

/**
 * Parses command line arguments
 */
function parseArgs(): { command: string; args: string[] } {
  const args = process.argv.slice(2);
  const command = args[0] || 'interactive';
  const restArgs = args.slice(1);
  return { command, args: restArgs };
}

/**
 * Initializes identity files by copying templates to memory directory
 */
async function initCommand(): Promise<void> {
  console.log(chalk.blue('Initializing Jarvis...'));

  // Create memory directory
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
    console.log(chalk.green('Created memory directory'));
  }

  // Copy templates to memory if they don't exist
  if (existsSync(TEMPLATES_DIR)) {
    const templates = readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.md'));

    for (const template of templates) {
      const destPath = join(MEMORY_DIR, template);
      if (!existsSync(destPath)) {
        copyFileSync(join(TEMPLATES_DIR, template), destPath);
        console.log(chalk.green(`Created ${template}`));
      } else {
        console.log(chalk.yellow(`${template} already exists, skipping`));
      }
    }
  }

  console.log(chalk.blue('\nJarvis initialized! You can now:'));
  console.log(chalk.white('  - Edit memory/SOUL.md to define personality'));
  console.log(chalk.white('  - Edit memory/BRAIN.md to add knowledge'));
  console.log(chalk.white('  - Edit memory/IMPERATIVE.md to set principles'));
  console.log(chalk.white('\nRun without arguments to start interactive mode.'));
}

/**
 * Lists available skills
 */
async function skillsCommand(): Promise<void> {
  const spinner = ora('Loading skills...').start();

  try {
    const orchestrator = getOrchestrator();
    const skills = await orchestrator.getSkills();

    spinner.stop();

    if (skills.length === 0) {
      console.log(chalk.yellow('No skills found in skills/ directory'));
      return;
    }

    console.log(chalk.blue(`\nAvailable Skills (${skills.length}):\n`));

    for (const skill of skills) {
      console.log(chalk.green(`  ${skill.name}`));
      console.log(chalk.white(`    ${skill.description}`));

      if (skill.triggers.length > 0) {
        console.log(chalk.gray(`    Triggers: ${skill.triggers.join(', ')}`));
      }

      if (skill.tools.length > 0) {
        console.log(chalk.gray(`    Tools: ${skill.tools.join(', ')}`));
      }

      console.log(chalk.gray(`    Model: ${skill.model.provider}/${skill.model.model}`));
      console.log('');
    }
  } catch (error) {
    spinner.fail('Failed to load skills');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Processes a single chat message
 */
async function chatCommand(message: string): Promise<void> {
  if (!message.trim()) {
    console.log(chalk.yellow('Please provide a message'));
    return;
  }

  const spinner = ora('Thinking...').start();

  try {
    const orchestrator = getOrchestrator();
    const response = await orchestrator.process(message);

    spinner.stop();
    console.log(chalk.green('\nJarvis:'), response);
  } catch (error) {
    spinner.fail('Error');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Creates a readline interface from /dev/tty for direct terminal access
 * Returns null if no TTY is available
 */
async function createTtyReadline(): Promise<Interface | null> {
  try {
    const handle = await open('/dev/tty', 'r');
    const stream = handle.createReadStream();
    const rl = createInterface({
      input: stream,
      output: process.stdout,
      terminal: true,
    });
    // Attach error handler to prevent unhandled error events
    stream.on('error', () => {
      rl.close();
    });
    return rl;
  } catch {
    return null;
  }
}

/**
 * Creates a readline interface from stdin
 */
function createStdinReadline(): Interface {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Interactive REPL mode
 */
async function interactiveMode(): Promise<void> {
  console.log(chalk.blue('\n🤖 Jarvis Interactive Mode'));
  console.log(chalk.gray('Type your message and press Enter. Commands:'));
  console.log(chalk.gray('  /quit    - Exit'));
  console.log(chalk.gray('  /clear   - Clear conversation history'));
  console.log(chalk.gray('  /skills  - List available skills'));
  console.log(chalk.gray('  /help    - Show this help\n'));

  // Load previous conversation
  loadConversation();

  let rl = createStdinReadline();
  const orchestrator = getOrchestrator();
  let shouldExit = false;

  const handleInput = async (input: string): Promise<void> => {
    const trimmed = input.trim();

    // Handle commands
    if (trimmed.startsWith('/')) {
      const cmd = trimmed.slice(1).toLowerCase();

      switch (cmd) {
        case 'quit':
        case 'exit':
        case 'q':
          shouldExit = true;
          saveConversation();
          console.log(chalk.blue('\nGoodbye!'));
          rl.close();
          return;

        case 'clear':
          clearConversation();
          console.log(chalk.green('Conversation cleared.\n'));
          return;

        case 'skills':
          await skillsCommand();
          return;

        case 'help':
          console.log(chalk.gray('\nCommands:'));
          console.log(chalk.gray('  /quit    - Exit'));
          console.log(chalk.gray('  /clear   - Clear conversation history'));
          console.log(chalk.gray('  /skills  - List available skills'));
          console.log(chalk.gray('  /help    - Show this help\n'));
          return;

        default:
          console.log(chalk.yellow(`Unknown command: ${cmd}\n`));
          return;
      }
    }

    // Skip empty input
    if (!trimmed) {
      return;
    }

    // Process the message
    const spinner = ora('Thinking...').start();

    try {
      const response = await orchestrator.process(trimmed);
      spinner.stop();
      console.log(chalk.green('\nJarvis:'), response, '\n');
    } catch (error) {
      spinner.fail('Error');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)), '\n');
    }
  };

  console.log(shouldExit, "shouldExit initial value");

  // Main REPL loop - continues until explicit quit
  while (!shouldExit) {
    try {
      const input = await new Promise<string>((resolve, reject) => {
        rl.question(chalk.cyan('You: '), resolve);
        //rl.once('close', () => reject(new Error('readline closed')));
        rl.once('error', reject);
      });

      await handleInput(input);
    } catch {
      // Readline closed (Ctrl+C, Ctrl+D, or piped input ended)
      if (shouldExit) break;

      // Try to switch to /dev/tty for continued terminal input
      const ttyRl = await createTtyReadline();
      if (ttyRl) {
        rl = ttyRl;
        console.log(''); // Newline after piped input
      } else {
        // No TTY available, exit gracefully
        shouldExit = true;
        saveConversation();
        console.log(chalk.blue('\nGoodbye!'));
      }
    }
  }
}

/**
 * Shows help message
 */
function showHelp(): void {
  console.log(chalk.blue('\nJarvis - Personal AI Agent Framework\n'));
  console.log(chalk.white('Usage:'));
  console.log(chalk.white('  jarvis                    Interactive mode (REPL)'));
  console.log(chalk.white('  jarvis chat "<message>"   Send a single message'));
  console.log(chalk.white('  jarvis init               Initialize identity files'));
  console.log(chalk.white('  jarvis skills             List available skills'));
  console.log(chalk.white('  jarvis help               Show this help\n'));
  console.log(chalk.gray('Examples:'));
  console.log(chalk.gray('  npm run jarvis'));
  console.log(chalk.gray('  npm run jarvis -- chat "What can you do?"'));
  console.log(chalk.gray('  npm run jarvis -- init'));
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { command, args } = parseArgs();

  switch (command) {
    case 'interactive':
    case 'i':
      await interactiveMode();
      break;

    case 'chat':
    case 'c':
      await chatCommand(args.join(' '));
      break;

    case 'init':
      await initCommand();
      break;

    case 'skills':
    case 's':
      await skillsCommand();
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      // If the command looks like a message, treat it as chat
      if (!command.startsWith('-')) {
        await chatCommand([command, ...args].join(' '));
      } else {
        console.log(chalk.red(`Unknown command: ${command}`));
        showHelp();
        process.exit(1);
      }
  }
}

// Run
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
