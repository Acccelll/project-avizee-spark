import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Human-readable block label shown in the error fallback (e.g. "Financeiro"). */
  label?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Compact error boundary for individual dashboard blocks.
 * If a block crashes it shows a small inline fallback instead of
 * taking down the whole dashboard.
 */
export class BlockErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[BlockErrorBoundary:${this.props.label ?? "block"}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive/70" />
          <p className="text-sm text-muted-foreground">
            {this.props.label
              ? `O bloco "${this.props.label}" encontrou um erro.`
              : "Este bloco encontrou um erro."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ hasError: false })}
          >
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
