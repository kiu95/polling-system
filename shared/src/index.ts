export interface PollOption {
  id: string;
  label: string;
}

export interface ActivePoll {
  id: string;
  question: string;
  options: PollOption[];
}

export interface VoteAccepted {
  pollId: string;
  optionId: string;
}

export interface PollResultOption {
  id: string;
  count: number;
  label: string;
  percentage: number;
}

export interface PollResults {
  total: number;
  pollId: string;
  options: PollResultOption[];
}
