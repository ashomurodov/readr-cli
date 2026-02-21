export interface Book {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  addedAt: string;
  finishedAt?: string;
}

export interface Session {
  id: string;
  bookId: string;
  startPage: number;
  endPage?: number;
  startTime: string;
  endTime?: string;
  pausedAt?: string;
  totalPausedMs: number;
  status: 'active' | 'paused' | 'completed';
}

export interface Store {
  books: Book[];
  sessions: Session[];
  activeSessionId?: string;
}
