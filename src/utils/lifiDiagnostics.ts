export function analyzeLifiTransaction(quote: any) {
  console.log("=== LiFi Transaction Analysis ===");
  
  // Check if contract calls are present
  if (quote?.action?.destinationCallData) {
    console.log("✅ Destination call data present");
    console.log("Destination call data length:", quote.action.destinationCallData.length);
  } else {
    console.log("❌ No destination call data - transaction will only swap, not deposit!");
  }
  
  // Check included steps
  if (quote?.includedSteps) {
    console.log("\nIncluded Steps:");
    quote.includedSteps.forEach((step: any, i: number) => {
      console.log(`${i + 1}. ${step.type} via ${step.tool}`);
      if (step.type === 'custom') {
        console.log("   - Custom step detected (should be your deposit)");
      }
    });
  }
  
  // Check contract calls in estimate
  if (quote?.estimate?.data?.contractCalls) {
    console.log("\nContract Calls in Estimate:");
    quote.estimate.data.contractCalls.forEach((call: any, i: number) => {
      console.log(`Call ${i + 1}:`);
      console.log("  - To:", call.toContractAddress);
      console.log("  - Data preview:", call.toContractCallData?.slice(0, 10));
      console.log("  - Gas limit:", call.toContractGasLimit);
    });
  }
  
  // Check if destination chain execution is enabled
  if (quote?.estimate?.executionDuration) {
    console.log("\nExecution duration:", quote.estimate.executionDuration);
  }
  
  console.log("=== End Analysis ===");
}

export function compareTransactionStructure(successfulQuote: any, failedQuote: any) {
  console.log("=== Comparing Transaction Structures ===");
  
  const hasDestCallSuccess = !!successfulQuote?.action?.destinationCallData;
  const hasDestCallFailed = !!failedQuote?.action?.destinationCallData;
  
  console.log("Successful tx has destination call:", hasDestCallSuccess);
  console.log("Failed tx has destination call:", hasDestCallFailed);
  
  if (!hasDestCallFailed && hasDestCallSuccess) {
    console.log("⚠️  ISSUE: Failed transaction is missing destination call data!");
    console.log("This means LiFi decided to skip the contract calls.");
    console.log("Possible reasons:");
    console.log("1. Approve targeting wrong address");
    console.log("2. Insufficient gas estimates");
    console.log("3. Contract validation failed");
    console.log("4. Amount mismatch between swap output and contract call input");
  }
  
  console.log("=== End Comparison ===");
}