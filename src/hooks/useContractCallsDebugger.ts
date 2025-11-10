import { type ContractCallsQuoteRequest } from "@lifi/sdk";

export function useContractCallsDebugger() {
  const debugContractCalls = (quote: any) => {
    console.log("=== Contract Calls Debug ===");
    
    // Check if the quote has contract calls info
    if (quote?.action?.toToken) {
      console.log("Destination token:", quote.action.toToken);
    }
    
    if (quote?.estimate?.approvalAddress) {
      console.log("Approval address from quote:", quote.estimate.approvalAddress);
    }
    
    if (quote?.includedSteps) {
      console.log("Included steps:", quote.includedSteps.length);
      quote.includedSteps.forEach((step: any, index: number) => {
        console.log(`Step ${index + 1}:`, {
          type: step.type,
          tool: step.tool,
          action: step.action?.type,
        });
      });
    }
    
    // Check if destination calls are included
    if (quote?.estimate?.data?.destinationCallData) {
      console.log("Has destination call data:", !!quote.estimate.data.destinationCallData);
    }
    
    // Check the route
    if (quote?.route) {
      console.log("Route info:", {
        fromToken: quote.route.fromToken,
        toToken: quote.route.toToken,
        fromAmount: quote.route.fromAmount,
        toAmount: quote.route.toAmount,
      });
    }
    
    console.log("=== End Contract Calls Debug ===");
  };
  
  const validateContractCalls = (params: ContractCallsQuoteRequest & { contractCalls: any[] }) => {
    console.log("=== Validating Contract Calls ===");
    
    const errors: string[] = [];
    
    // Validate contract calls structure
    params.contractCalls.forEach((call, index) => {
      console.log(`Contract Call ${index + 1}:`, {
        fromAmount: call.fromAmount,
        fromTokenAddress: call.fromTokenAddress,
        toContractAddress: call.toContractAddress,
        gasLimit: call.toContractGasLimit,
        hasCallData: !!call.toContractCallData,
        callDataLength: call.toContractCallData?.length,
        callDataPreview: call.toContractCallData?.slice(0, 10),
      });
      
      if (!call.toContractCallData) {
        errors.push(`Contract call ${index + 1} missing call data`);
      }
      
      if (!call.toContractAddress) {
        errors.push(`Contract call ${index + 1} missing contract address`);
      }
      
      // Check if approve is called on token contract
      if (call.toContractCallData?.startsWith('0x095ea7b3')) {
        console.log(`Call ${index + 1} is approve function`);
        if (call.toContractAddress !== call.fromTokenAddress) {
          console.warn(`WARNING: Approve call targeting wrong contract!`);
          console.warn(`Token: ${call.fromTokenAddress}`);
          console.warn(`Target: ${call.toContractAddress}`);
        }
      }
    });
    
    if (errors.length > 0) {
      console.error("Validation errors:", errors);
    }
    
    console.log("=== End Validation ===");
    
    return errors;
  };
  
  return {
    debugContractCalls,
    validateContractCalls,
  };
}