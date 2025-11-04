export function parseUnits(value: string, decimals: number): string {
  try {
    // Remove any commas and trim whitespace
    const cleanValue = value.replace(/,/g, '').trim();
    
    // Check if it's a valid number
    const num = parseFloat(cleanValue);
    if (isNaN(num)) {
      throw new Error('Invalid number');
    }
    
    // Convert to BigNumber string
    const factor = Math.pow(10, decimals);
    const result = Math.floor(num * factor);
    
    return result.toString();
  } catch (err) {
    console.error('Error parsing units:', err);
    return '0';
  }
}

export function formatUnits(value: string, decimals: number): string {
  try {
    const bigIntValue = BigInt(value);
    const factor = BigInt(Math.pow(10, decimals));
    const wholePart = bigIntValue / factor;
    const fractionalPart = bigIntValue % factor;
    
    // Convert fractional part to string with proper padding
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    
    // Remove trailing zeros
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    
    if (trimmedFractional === '') {
      return wholePart.toString();
    }
    
    return `${wholePart}.${trimmedFractional}`;
  } catch (err) {
    console.error('Error formatting units:', err);
    return '0';
  }
}

// Common token decimals
export const TOKEN_DECIMALS: Record<string, number> = {
  // Ethereum Mainnet
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 6,  // USDC
  '0xdAC17F958D2ee523a2206206994597C13D831ec7': 6,  // USDT
  '0x6B175474E89094C44Da98b954EedeAC495271d0F': 18, // DAI
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 18, // WETH
  
  // Optimism
  '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85': 6,  // USDC
  '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58': 6,  // USDT
  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1': 18, // DAI
  '0x4200000000000000000000000000000000000006': 18, // WETH
  
  // Native tokens (always 18 decimals)
  '0x0000000000000000000000000000000000000000': 18, // ETH
};