import { Component, type ReactNode } from "react";
import { Button } from "@/ui";

interface Props {
  children: ReactNode;
  /** Called before a retry remounts the children (e.g. to forget a failed lazy chunk). */
  onReset?: () => void;
}

interface State {
  error: unknown;
  attempt: number;
}

/**
 * Wraps a panel tab's view so one broken tab never blanks the homepage. Shows
 * a quiet line with Retry, which remounts the view.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error ?? new Error("unknown error") };
  }

  componentDidCatch(error: unknown): void {
    console.error("panel tab:", error);
  }

  private retry = () => {
    this.props.onReset?.();
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <div className="panel-error" role="alert">
          <p className="panel-error__text">Something went wrong in this tab.</p>
          <Button variant="secondary" onClick={this.retry}>
            Retry
          </Button>
        </div>
      );
    }
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}
