interface HTMLElement {
  scrollTop: number;
  scrollHeight: number;
}

interface Model {
  name: string;
  id: string;
}

interface Event {
  target: HTMLElement;
  stopPropagation: () => void;
} 