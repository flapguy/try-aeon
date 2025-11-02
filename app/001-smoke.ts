import { privateKeyToAccount } from "viem/accounts";
import { createPaymentHeader, x402Version } from "@aeon-ai-pay/x402";
import { EvmClient, PaymentRequirements } from "@aeon-ai-pay/x402/types";
// workaround: cannot resolve deps in  "@aeon-ai-pay/x402/verify" 
import { useFacilitator } from "./facilitator.js";
import { createWalletClient, Hex, http, publicActions } from "viem";
import { bsc } from "viem/chains";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const facilitatorUrl = "https://facilitator.aeon.xyz";

// Our test recipient 
const TO_ADDRESS = "0x14276B249fC7c640Ee2406F28EF9f26E1069b5e8";

// x402BNB token address on BSC 
// Note: This is a temporary contract address 
//       On Launch, we will grind a vanity address for x402BNB 
const X402BNB_ADDRESS = "0xFD8578De9Bf1D6e4E387a02747B3d9F0E2B1757D";

// Payer Wallet 
const payer = privateKeyToAccount(process.env.PAYER_PRIVATE_KEY as Hex);

(async () => {

    // 0. payment requirement 
    //   We want to pay 0.0001 x402BNB to TO_ADDRESS 
    const paymentRequirements = {
        scheme: "exact",
        // Note: extra field in Aeon spec which does not present in coinbase x402 spec 
        namespace: "evm",
        tokenAddress: X402BNB_ADDRESS,
        // Note: The amount is not the same as the coinbase x402 spec.
        amountRequired: 0.0001,
        amountRequiredFormat: "humanReadable",
        payToAddress: TO_ADDRESS,
        networkId: "56",
        description: "Payment of 0.0001 x402BNB",
        tokenSymbol: "x402BNB",
        tokenDecimals: 18,
        outputSchema: {
            input: {
                type: "http",
                method: "GET",
                discoverable: true,
            },
        },
        extra: {
            name: "x402 Wrapped BNB",
            version: "1", // EIP712 version
        },
    } as unknown as PaymentRequirements;


    // 1. create payment header  (i.e the payment payload)
    const walletClient = createWalletClient({
        account: payer,
        chain: bsc,
        transport: http(),
    });
    const paymentPayload  = await createPaymentHeader({
        evmClient: walletClient.extend(publicActions) as unknown as EvmClient
    }, x402Version, paymentRequirements);

    console.log("Payment Payload:", paymentPayload);


    const {verify, settle} = useFacilitator({
        url: facilitatorUrl,
    });


    // 2. verify on facilitator  
    const verifyResp = await verify(paymentPayload,paymentRequirements);
    console.log("Verify Response:", verifyResp);

    if(!verifyResp.isValid){
        throw new Error(`Failed to verify payment on facilitator: ${verifyResp.errorMessage}`);
    }

    // 3. settle on facilitator
    const settleResp = await settle(paymentPayload,paymentRequirements);
    console.log("Settle Response:", settleResp);

})().catch((err) => {
    console.error("Error in smoke test:", err);
}).then(() => {
    console.log("Smoke test completed.");
});