#!/usr/bin/env node
import readline from 'readline';
import chalk from 'chalk';
import { loadStore, saveStore, generateId } from './store.js';
import { printBookCard, printSessionSummary, progressBar, formatDuration, getBookStats } from './display.js';
import { Book, Session } from './types.js';

const args = process.argv.slice(2);
const command = args[0];

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

async function promptWithDefault(label: string, defaultValue: string): Promise<string> {
  const display = defaultValue ? ` (${defaultValue})` : '';
  const input = await prompt(chalk.cyan(`  ${label}${display}: `));
  return input || defaultValue;
}

async function select(message: string, options: string[]): Promise<number> {
  return new Promise((resolve) => {
    let cursor = 0;

    function render(first = false) {
      if (!first) {
        process.stdout.write(`\x1b[${options.length + 1}A`);
      }
      process.stdout.write(`\r\x1b[2K  ${chalk.cyan(message)}\n`);
      for (let i = 0; i < options.length; i++) {
        const line = i === cursor
          ? `  ${chalk.green('❯')} ${chalk.bold(options[i])}`
          : `    ${chalk.gray(options[i])}`;
        process.stdout.write(`\r\x1b[2K${line}\n`);
      }
    }

    render(true);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    function onData(key: string) {
      if (key === '\x1b[A') {
        cursor = (cursor - 1 + options.length) % options.length;
        render();
      } else if (key === '\x1b[B') {
        cursor = (cursor + 1) % options.length;
        render();
      } else if (key === ' ' || key === '\r' || key === '\n') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(cursor);
      } else if (key === '\x03') {
        process.exit(0);
      }
    }

    process.stdin.on('data', onData);
  });
}

function header() {
  console.log('');
  console.log(chalk.bold.magenta('  📚 Reading Tracker'));
  console.log(chalk.gray('  ─────────────────────────────────'));
}

async function addBook() {
  header();
  let title = '';
  let author = '';
  let totalPagesStr = '';
  let currentPageStr = '0';

  while (true) {
    console.log('');
    title = await promptWithDefault('Book title', title);
    author = await promptWithDefault('Author', author);
    totalPagesStr = await promptWithDefault('Total pages', totalPagesStr);
    currentPageStr = await promptWithDefault('Current page', currentPageStr);

    const totalPages = parseInt(totalPagesStr);
    const currentPage = parseInt(currentPageStr) || 0;

    if (!title || isNaN(totalPages)) {
      console.log(chalk.red('\n  ✗ Title and total pages are required.'));
      continue;
    }
    if (currentPage > totalPages) {
      console.log(chalk.red('\n  ✗ Current page cannot exceed total pages.'));
      continue;
    }

    console.log('');
    const action = await select('Save this book?', ['Save', 'Cancel']);
    if (action === 0) {
      const store = loadStore();
      const book: Book = {
        id: generateId(),
        title,
        author,
        totalPages,
        currentPage,
        addedAt: new Date().toISOString(),
      };
      store.books.push(book);
      saveStore(store);
      console.log(chalk.green(`\n  ✓ Added "${title}"!`));
      printBookCard(book, []);
      return;
    }
    console.log('');
  }
}

async function startSession() {
  const store = loadStore();

  const existing = store.sessions.find(
    (s) => s.status === 'active' || s.status === 'paused'
  );
  if (existing) {
    const book = store.books.find((b) => b.id === existing.bookId)!;
    console.log(chalk.yellow(`\n  ⚠ You already have a session for "${book.title}" (${existing.status})`));
    console.log(chalk.gray('  Use: read pause | read stop\n'));
    process.exit(1);
  }

  if (store.books.length === 0) {
    console.log(chalk.red('\n  No books found. Add one with: read add\n'));
    process.exit(1);
  }

  header();
  const bookOptions = store.books.map((b) => `${b.title}  — page ${b.currentPage}/${b.totalPages}`);
  const choice = await select('Pick a book to start reading:', bookOptions);
  const book = store.books[choice];

  const startPageStr = await prompt(
    chalk.cyan(`  Starting from page (enter for ${book.currentPage}): `)
  );
  const startPage = parseInt(startPageStr) || book.currentPage;

  const session: Session = {
    id: generateId(),
    bookId: book.id,
    startPage,
    startTime: new Date().toISOString(),
    totalPausedMs: 0,
    status: 'active',
  };

  store.sessions.push(session);
  store.activeSessionId = session.id;
  saveStore(store);

  console.log('');
  console.log(chalk.green(`  ▶  Session started for "${book.title}"`));
  console.log(chalk.gray(`     From page ${startPage} — happy reading! 📖`));
  console.log('');
}

function pauseSession() {
  const store = loadStore();
  const session = store.sessions.find((s) => s.status === 'active' || s.status === 'paused');

  if (!session) {
    console.log(chalk.red('\n  No active session. Start one with: read start\n'));
    process.exit(1);
  }

  const book = store.books.find((b) => b.id === session.bookId)!;

  if (session.status === 'paused') {
    const pausedMs = new Date().getTime() - new Date(session.pausedAt!).getTime();
    session.totalPausedMs += pausedMs;
    session.pausedAt = undefined;
    session.status = 'active';
    saveStore(store);
    console.log(chalk.green(`\n  ▶  Resumed "${book.title}"\n`));
  } else {
    session.pausedAt = new Date().toISOString();
    session.status = 'paused';
    saveStore(store);
    const elapsed = new Date().getTime() - new Date(session.startTime).getTime() - session.totalPausedMs;
    console.log(chalk.yellow(`\n  ⏸  Paused "${book.title}" — ${formatDuration(elapsed)} so far\n`));
  }
}

async function stopSession() {
  const store = loadStore();
  const session = store.sessions.find((s) => s.status === 'active' || s.status === 'paused');

  if (!session) {
    console.log(chalk.red('\n  No active session. Start one with: read start\n'));
    process.exit(1);
  }

  const book = store.books.find((b) => b.id === session.bookId)!;

  const endPageStr = await prompt(
    chalk.cyan(`\n  Ending on page (enter for current ${book.currentPage}): `)
  );
  const endPage = parseInt(endPageStr) || book.currentPage;

  if (session.status === 'paused' && session.pausedAt) {
    session.totalPausedMs += new Date().getTime() - new Date(session.pausedAt).getTime();
  }

  session.endPage = endPage;
  session.endTime = new Date().toISOString();
  session.status = 'completed';
  delete store.activeSessionId;

  book.currentPage = endPage;

  saveStore(store);
  printSessionSummary(session, book);
  printBookCard(book, store.sessions);
}

function listBooks() {
  const store = loadStore();
  if (store.books.length === 0) {
    console.log(chalk.gray('\n  No books yet. Add one with: read add\n'));
    return;
  }
  header();
  for (const book of store.books) {
    printBookCard(book, store.sessions, store.activeSessionId);
  }
}

function showStats() {
  const store = loadStore();
  if (store.books.length === 0) {
    console.log(chalk.gray('\n  No books yet. Add one with: read add\n'));
    return;
  }

  header();
  console.log(chalk.bold('  📊 Overall Stats\n'));

  const completedSessions = store.sessions.filter((s) => s.status === 'completed');
  const totalMs = completedSessions.reduce((acc, s) => {
    if (!s.endTime) return acc;
    return acc + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime() - s.totalPausedMs);
  }, 0);

  const totalPages = completedSessions.reduce((acc, s) => {
    return acc + ((s.endPage ?? s.startPage) - s.startPage);
  }, 0);

  console.log(`  ${chalk.yellow('Total reading time:')}  ${chalk.bold(formatDuration(totalMs))}`);
  console.log(`  ${chalk.yellow('Total pages read:')}   ${chalk.bold(totalPages)}`);
  console.log(`  ${chalk.yellow('Total sessions:')}     ${chalk.bold(completedSessions.length)}`);
  console.log('');

  for (const book of store.books) {
    const stats = getBookStats(book, store.sessions);
    console.log(`  ${chalk.bold.cyan(book.title)}`);
    console.log(`  ${progressBar(book.currentPage, book.totalPages, 25)}`);
    if (stats.pagesPerHour > 0) {
      console.log(
        `  ${chalk.gray(`${book.currentPage}/${book.totalPages} pages · ${stats.pagesPerHour.toFixed(1)} pg/hr · ETA: ${stats.etaMs !== null ? formatDuration(stats.etaMs) : '?'}`)}`
      );
    }
    console.log('');
  }
}

async function editBook() {
  const store = loadStore();

  if (store.books.length === 0) {
    console.log(chalk.gray('\n  No books yet. Add one with: readr add\n'));
    return;
  }

  header();
  const bookOptions = store.books.map((b) => `${b.title}  — page ${b.currentPage}/${b.totalPages}`);
  const choice = await select('Pick a book to edit:', bookOptions);
  const book = store.books[choice];

  let title = book.title;
  let author = book.author;
  let totalPagesStr = String(book.totalPages);
  let currentPageStr = String(book.currentPage);

  while (true) {
    console.log(chalk.gray('\n  Press Enter to keep the shown value.\n'));
    title = await promptWithDefault('Title', title);
    author = await promptWithDefault('Author', author);
    totalPagesStr = await promptWithDefault('Total pages', totalPagesStr);
    currentPageStr = await promptWithDefault('Current page', currentPageStr);

    const totalPages = parseInt(totalPagesStr);
    const currentPage = parseInt(currentPageStr);

    if (isNaN(totalPages) || isNaN(currentPage)) {
      console.log(chalk.red('\n  ✗ Invalid page number.'));
      continue;
    }
    if (currentPage > totalPages) {
      console.log(chalk.red('\n  ✗ Current page cannot exceed total pages.'));
      continue;
    }

    console.log('');
    const action = await select('Save changes?', ['Save', 'Cancel']);
    if (action === 0) {
      book.title = title;
      book.author = author;
      book.totalPages = totalPages;
      book.currentPage = currentPage;
      if (currentPage >= totalPages && !book.finishedAt) {
        book.finishedAt = new Date().toISOString();
      } else if (currentPage < totalPages) {
        delete book.finishedAt;
      }
      saveStore(store);
      console.log(chalk.green(`\n  ✓ Updated "${book.title}"!`));
      printBookCard(book, store.sessions);
      return;
    }
    console.log('');
  }
}

async function removeBook() {
  const store = loadStore();

  if (store.books.length === 0) {
    console.log(chalk.gray('\n  No books yet. Add one with: readr add\n'));
    return;
  }

  header();
  const bookOptions = store.books.map((b) => `${b.title}  — page ${b.currentPage}/${b.totalPages}`);
  const bookIdx = await select('Pick a book to remove:', bookOptions);
  const book = store.books[bookIdx];

  console.log('');
  console.log(chalk.yellow(`  ⚠  Remove "${chalk.bold(book.title)}"? This cannot be undone.`));
  console.log('');

  const confirmIdx = await select('Confirm your choice:', ['Cancel', 'Confirm']);

  if (confirmIdx === 0) {
    console.log(chalk.gray('\n  Cancelled.\n'));
    return;
  }

  store.books = store.books.filter((b) => b.id !== book.id);
  store.sessions = store.sessions.filter((s) => s.bookId !== book.id);
  if (store.activeSessionId) {
    const still = store.sessions.find((s) => s.id === store.activeSessionId);
    if (!still) delete store.activeSessionId;
  }

  saveStore(store);
  console.log(chalk.red(`\n  ✓ Removed "${book.title}".\n`));
}

function showHelp() {
  header();
  console.log(chalk.bold('  Commands:\n'));
  const cmds = [
    ['readr add',    'Add a new book'],
    ['readr edit',   'Edit a book\'s details'],
    ['readr remove', 'Remove a book'],
    ['readr start',  'Start a reading session'],
    ['readr pause',  'Pause or resume current session'],
    ['readr stop',   'End session & log pages read'],
    ['readr list',   'List all books with progress'],
    ['readr stats',  'Overall reading statistics'],
    ['readr help',   'Show this help'],
  ];
  for (const [cmd, desc] of cmds) {
    console.log(`  ${chalk.bold.green(cmd.padEnd(14))} ${chalk.gray(desc)}`);
  }
  console.log('');
}

(async () => {
  switch (command) {
    case 'add':    await addBook(); break;
    case 'edit':   await editBook(); break;
    case 'remove': await removeBook(); break;
    case 'start':  await startSession(); break;
    case 'pause':  pauseSession(); break;
    case 'stop':   await stopSession(); break;
    case 'list':   listBooks(); break;
    case 'stats':  showStats(); break;
    case 'help':
    default:       showHelp(); break;
  }
})();
