import chalk from 'chalk';
import { Book, Session } from './types.js';

export function progressBar(current: number, total: number, width = 30): string {
  const pct = Math.min(current / total, 1);
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `[${bar}] ${chalk.bold((pct * 100).toFixed(1))}%`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function getBookStats(book: Book, sessions: Session[]) {
  const bookSessions = sessions.filter(
    (s) => s.bookId === book.id && s.status === 'completed'
  );

  const totalMs = bookSessions.reduce((acc, s) => {
    if (!s.endTime) return acc;
    const raw = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
    return acc + raw - s.totalPausedMs;
  }, 0);

  const totalPagesRead = bookSessions.reduce((acc, s) => {
    return acc + ((s.endPage ?? s.startPage) - s.startPage);
  }, 0);

  const pagesPerHour = totalMs > 0 ? (totalPagesRead / totalMs) * 3600000 : 0;
  const pagesLeft = book.totalPages - book.currentPage;
  const etaMs = pagesPerHour > 0 ? (pagesLeft / pagesPerHour) * 3600000 : null;

  return { totalMs, totalPagesRead, pagesPerHour, etaMs, sessionCount: bookSessions.length };
}

export function printBookCard(book: Book, sessions: Session[], activeSessionId?: string) {
  const stats = getBookStats(book, sessions);
  const isActive = sessions.find(
    (s) => s.bookId === book.id && (s.status === 'active' || s.status === 'paused')
  );

  console.log('');
  console.log(chalk.bold.cyan(`📖 ${book.title}`) + chalk.gray(` by ${book.author}`));
  console.log(`   ${progressBar(book.currentPage, book.totalPages)}`);
  console.log(
    `   ${chalk.yellow('Page:')} ${chalk.bold(book.currentPage)} / ${book.totalPages}  ` +
    `${chalk.yellow('Sessions:')} ${stats.sessionCount}  ` +
    `${chalk.yellow('Time:')} ${formatDuration(stats.totalMs)}`
  );

  if (stats.pagesPerHour > 0) {
    console.log(
      `   ${chalk.yellow('Speed:')} ${stats.pagesPerHour.toFixed(1)} pages/hr  ` +
      (stats.etaMs !== null
        ? `${chalk.yellow('ETA:')} ${chalk.bold.green(formatDuration(stats.etaMs))} left`
        : '')
    );
  } else {
    console.log(`   ${chalk.gray('No speed data yet — start a session!')}`);
  }

  if (isActive) {
    const status = isActive.status === 'paused' ? chalk.yellow('⏸  PAUSED') : chalk.green('▶  READING');
    console.log(`   ${status} ${chalk.gray(`from page ${isActive.startPage}`)}`);
  }
  console.log('');
}

export function printSessionSummary(session: Session, book: Book) {
  const pagesRead = (session.endPage ?? session.startPage) - session.startPage;
  const rawMs = new Date(session.endTime!).getTime() - new Date(session.startTime).getTime();
  const activeMs = rawMs - session.totalPausedMs;
  const speed = activeMs > 0 ? (pagesRead / activeMs) * 3600000 : 0;

  console.log('');
  console.log(chalk.bold.green('✅  Session complete!'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  ${chalk.yellow('Book:')}       ${book.title}`);
  console.log(`  ${chalk.yellow('Pages:')}      ${session.startPage} → ${session.endPage}  ${chalk.bold('(+' + pagesRead + ')')}`);
  console.log(`  ${chalk.yellow('Duration:')}   ${formatDuration(activeMs)}`);
  console.log(`  ${chalk.yellow('Speed:')}      ${speed.toFixed(1)} pages/hr`);
  console.log(chalk.gray('─'.repeat(40)));
  console.log('');
}
