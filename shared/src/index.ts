export interface PollOption {
  id: string;
  label: string;
}

export interface ActivePoll {
  id: string;
  question: string;
  options: PollOption[];
}
