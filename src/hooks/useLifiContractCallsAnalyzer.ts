export function useLifiContractCallsAnalyzer() {
  
  const analyzeQuoteFailure = (quote: any, params: any) => {
    console.log("=== Analyzing Why Contract Calls Might Be Skipped ===");
    
    // Check 1: Destination call data presence
    const hasDestinationCall = !!quote?.action?.destinationCallData;
    console.log("Has destination call data:", hasDestinationCall);
    
    if (!hasDestinationCall) {
      console.log("❌ LiFi skipped contract calls! Possible reasons:");
      
      // Check if it's a cross-chain transaction
      if (params.fromChain !== params.toChain) {
        console.log("- Cross-chain transaction detected");
        console.log("  From chain:", params.fromChain);
        console.log("  To chain:", params.toChain);
      }
      
      // Check amounts
      if (quote?.estimate) {
        console.log("- Amount details:");
        console.log("  From amount:", quote.estimate.fromAmount);
        console.log("  To amount min:", quote.estimate.toAmountMin);
        console.log("  Execution duration:", quote.estimate.executionDuration);
      }
      
      // Check fees
      if (quote?.estimate?.gasCosts) {
        console.log("- Gas costs:");
        quote.estimate.gasCosts.forEach((cost: any) => {
          console.log(`  ${cost.type}: ${cost.amount} ${cost.token?.symbol}`);
        });
      }
      
      // Check route
      if (quote?.route) {
        console.log("- Route steps:", quote.route.steps?.length || 0);
      }
    }
    
    console.log("=== End Analysis ===");
  };
  
  const checkContractCallsSupport = (fromChain: string, toChain: string) => {
    console.log("=== Checking Contract Calls Support ===");
    
    // Same chain transactions should always support contract calls
    if (fromChain === toChain) {
      console.log("✅ Same-chain transaction - contract calls should be supported");
    } else {
      console.log("⚠️  Cross-chain transaction - contract calls support depends on bridge");
      console.log("Note: Some bridges don't support destination contract calls");
    }
    
    console.log("=== End Check ===");
  };
  
  const validateAmounts = (params: any, quote: any) => {
    console.log("=== Validating Amounts ===");
    
    if (quote?.estimate) {
      const requestedAmount = params.fromAmount;
      const quoteFromAmount = quote.estimate.fromAmount;
      const toAmountMin = quote.estimate.toAmountMin;
      
      console.log("Requested from amount:", requestedAmount);
      console.log("Quote from amount:", quoteFromAmount);
      console.log("Min receive amount:", toAmountMin);
      
      if (requestedAmount !== quoteFromAmount) {
        console.log("⚠️  Amount mismatch between request and quote!");
      }
    }
    
    console.log("=== End Validation ===");
  };
  
  return {
    analyzeQuoteFailure,
    checkContractCallsSupport,
    validateAmounts,
  };
}