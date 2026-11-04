export type ObjectSummary = { id: string; name: string; address: string; task_count: number };

export type ObjectInput = { name: string; address: string };

export type ObjectRow = { id: string; name: string; address: string; tasks: { count: number }[] };
