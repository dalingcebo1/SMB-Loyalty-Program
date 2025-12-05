export interface ClientAction {
  type: string;
  payload: Record<string, any>;
}

export interface ExtensionComponentProps {
  action: ClientAction;
  onComplete: () => void;
}

export type ExtensionComponent = React.ComponentType<ExtensionComponentProps>;
