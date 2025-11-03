/**
 * Converts data to a JSON-safe format by handling special cases like BigInt, Date, Map, Set, etc.
 *
 * @param data - The data to convert to JSON-safe format
 * @param seen - WeakSet to handle circular references (internal use)
 * @returns The JSON-safe version of the data
 * @throws {Error} If the input is not a valid object or array
 */
function toJsonSafe(data, seen = new WeakSet()) {
    if (!data || typeof data !== "object") {
        throw new Error("Input must be a valid object or array");
    }
    if (seen.has(data)) {
        return { "[Circular]": true };
    }
    seen.add(data);
    try {
        if (data instanceof Date) {
            return data.toISOString();
        }
        if (data instanceof Set) {
            return toJsonSafe(Array.from(data), seen);
        }
        if (data instanceof Map) {
            return toJsonSafe(Object.fromEntries(data), seen);
        }
        return Object.entries(data).reduce((result, [key, value]) => {
            if (value === undefined || value === null) {
                return result;
            }
            if (value instanceof Date) {
                result[key] = value.toISOString();
            }
            else if (typeof value === "bigint") {
                result[key] = value.toString();
            }
            else if (typeof value === "symbol") {
                result[key] = value.toString();
            }
            else if (value instanceof Set) {
                result[key] = Array.from(value);
            }
            else if (value instanceof Map) {
                result[key] = Object.fromEntries(value);
            }
            else if (Array.isArray(value)) {
                result[key] = value.map((item) => typeof item === "object" && item !== null
                    ? toJsonSafe(item, seen)
                    : item);
            }
            else if (typeof value === "object") {
                result[key] = toJsonSafe(value, seen);
            }
            else if (typeof value === "function") {
                result[key] = "[Function]";
            }
            else {
                result[key] = value;
            }
            return result;
        }, {});
    }
    catch (error) {
        throw new Error(`Failed to convert to JSON-safe format: ${error instanceof Error ? error.message : String(error)}`);
    }
}
export { toJsonSafe };
//# sourceMappingURL=toJsonSafe.js.map

const DEFAULT_FACILITATOR_URL = "https://facilitator.aeon.xyz";
/**
 * Creates a facilitator client for interacting with the x402 payment facilitator service
 *
 * @param facilitator - The facilitator config to use. If not provided, the default facilitator will be used.
 * @returns An object containing verify and settle functions for interacting with the facilitator
 */
export function useFacilitator(facilitator) {
    /**
     * Verifies a payment payload with the facilitator service
     *
     * @param payload - The payment payload to verify (base64 encoded)
     * @param paymentRequirements - The payment requirements to verify against
     * @returns A promise that resolves to the verification response
     */
    async function verify(payload, paymentRequirements) {
        console.log("[DEBUG-PAYMENT-FLOW] Making request to facilitator:", facilitator?.url);
        const url = facilitator?.url || DEFAULT_FACILITATOR_URL;
        let headers = { "Content-Type": "application/json" };
        if (facilitator?.createAuthHeaders) {
            const authHeaders = await facilitator.createAuthHeaders();
            headers = { ...headers, ...authHeaders.verify };
        }

        const requestBody = JSON.stringify({
            payload,
            paymentRequirements: toJsonSafe(paymentRequirements),
        });
        console.log(`${url}/verify`);
        console.log("body:\n", requestBody);
        
        // Generate curl command for testing
        const headersString = Object.entries(headers)
            .map(([key, value]) => `-H "${key}: ${value}"`)
            .join(' ');
        const curlCommand = `curl -X POST ${headersString} -d '${requestBody}' "${url}/verify"`;
        console.log("\nCurl command for testing:");
        console.log(curlCommand);

        const res = await fetch(`${url}/verify`, {
            method: "POST",
            headers,
            body: requestBody,
        });
        if (res.status !== 200) {
            // Try to get the detailed error message from the response
            let errorMessage = `Failed to verify payment: ${res.statusText}`;
            try {
                const errorData = await res.json();
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            }
            catch (e) {
                // If we can't parse JSON, use the default error message
            }
            return {
                isValid: false,
                errorMessage
            };
        }
        const data = await res.json();
        return data;
    }
    /**
     * Settles a payment with the facilitator service
     *
     * @param payload - The payment payload to settle (base64 encoded)
     * @param paymentRequirements - The payment requirements for the settlement
     * @returns A promise that resolves to the settlement response
     */
    async function settle(payload, paymentRequirements) {
        console.log("[DEBUG-PAYMENT-FLOW] Making request to facilitator:", facilitator?.url);
        const url = facilitator?.url || DEFAULT_FACILITATOR_URL;
        let headers = { "Content-Type": "application/json" };
        if (facilitator?.createAuthHeaders) {
            const authHeaders = await facilitator.createAuthHeaders();
            headers = { ...headers, ...authHeaders.settle };
        }
        const res = await fetch(`${url}/settle`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                payload,
                paymentRequirements: toJsonSafe(paymentRequirements),
            }),
        });
        if (res.status !== 200) {
            let responseBody = '';
            try {
                responseBody = await res.text();
                console.log("[DEBUG-PAYMENT-FLOW] Response body:", responseBody);
            } catch (e) {
                console.log("[DEBUG-PAYMENT-FLOW] Could not read response body");
            }
            const text = res.statusText;
            throw new Error(`Failed to settle payment: ${res.status} ${text}`);
        }
        const data = await res.json();
        return data;
    }
    return { verify, settle };
}
//# sourceMappingURL=useFacilitator.js.map