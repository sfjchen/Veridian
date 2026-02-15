import { Component, type ErrorInfo, type ReactNode } from "react";
import { View } from "react-native";

import { ErrorState } from "@/components/ui";

type Props = { children: ReactNode };

type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (__DEV__) {
      console.error("[ErrorBoundary]", error, errorInfo.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState
            message="Something went wrong. We couldn’t load this screen."
            onRetry={() => this.setState({ hasError: false })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}
