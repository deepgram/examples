import { JsonValue } from '@bufbuild/protobuf';

type Options = {
    /** Prefix for the RPC requests */
    prefix?: string;
    /** Timeout for fetch requests, in seconds. Must be within the valid range for abort signal timeouts. */
    requestTimeout?: number;
};
declare const livekitPackage = "livekit";
interface Rpc {
    request(service: string, method: string, data: JsonValue, headers: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    timeout?: number): Promise<string>;
}
declare class TwirpError extends Error {
    status: number;
    code?: string;
    metadata?: Record<string, string>;
    constructor(name: string, message: string, status: number, code?: string, metadata?: Record<string, string>);
}
/**
 * JSON based Twirp V7 RPC
 */
declare class TwirpRpc {
    host: string;
    pkg: string;
    prefix: string;
    requestTimeout: number;
    constructor(host: string, pkg: string, options?: Options);
    request(service: string, method: string, data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    headers: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    timeout?: number): Promise<any>;
}

export { type Rpc, TwirpError, TwirpRpc, livekitPackage };
