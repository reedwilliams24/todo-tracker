/* eslint-disable @typescript-eslint/no-explicit-any */
export type Given = Record<string, any>;
export type Status = "pass" | "missing" | "n/a";
export type PlatformStatus = { web: Status; ios: Status; android: Status };
export type Case = { name: string; op: string; given: Given };
/** One file per feature in features/: its cases, which platforms pass them, and the reference ops it adds. */
export type Feature = { feature: string; spec: string; status: PlatformStatus; cases: Case[] };
export type Ops = Record<string, (given: Given) => unknown>;
