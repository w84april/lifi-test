import { encodeFunctionData, type Address } from "viem";

// Test different deposit method encodings
const testAddress = "0x0000000000000000000000000000000000000001" as Address;
const testAmount = BigInt("1000000000000000000"); // 1 token

// Yearn V2 with recipient
const yearnV2WithRecipient = encodeFunctionData({
  abi: [{
    name: "deposit",
    type: "function",
    inputs: [
      { name: "_amount", type: "uint256" },
      { name: "_recipient", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  }],
  functionName: "deposit",
  args: [testAmount, testAddress],
});

console.log("Yearn V2 with recipient:", yearnV2WithRecipient);
// Expected: 0x6e553f65 + encoded(amount) + encoded(address)

// Yearn V2 without recipient
const yearnV2NoRecipient = encodeFunctionData({
  abi: [{
    name: "deposit",
    type: "function",
    inputs: [{ name: "_amount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  }],
  functionName: "deposit",
  args: [testAmount],
});

console.log("Yearn V2 no recipient:", yearnV2NoRecipient);
// Expected: 0xb6b55f25 + encoded(amount)

// ERC-4626 (Yearn V3)
const yearnV3 = encodeFunctionData({
  abi: [{
    name: "deposit",
    type: "function",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  }],
  functionName: "deposit",
  args: [testAmount, testAddress],
});

console.log("Yearn V3 ERC-4626:", yearnV3);
// Expected: 0x6e553f65 + encoded(amount) + encoded(address) (same signature as V2 with recipient)

// Approve function
const approve = encodeFunctionData({
  abi: [{
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  }],
  functionName: "approve",
  args: [testAddress, testAmount],
});

console.log("Approve:", approve);
// Expected: 0x095ea7b3 + encoded(address) + encoded(amount)