export interface Message {
    id: number;
    content: string;
}

export interface ConnectionData {
    clientId: string;
    message: Message;
}