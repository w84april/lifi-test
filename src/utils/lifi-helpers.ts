import { executeRoute as lifiExecuteRoute, type Route } from '@lifi/sdk';
import type { WalletClient } from 'viem';
import { JsonRpcProvider } from 'ethers';

// Helper to convert viem wallet client to ethers signer
export function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  
  if (!account || !chain || !transport) {
    throw new Error('Invalid wallet client');
  }
  
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  
  const provider = new JsonRpcProvider(
    transport.url || `https://rpc.ankr.com/eth`, 
    network
  );
  
  // Create a custom signer that uses the wallet client
  const signer = provider.getSigner(account.address);
  
  return signer;
}

// Wrapper for executeRoute that handles errors better
export async function executeLifiRoute(
  route: Route | any,
  options?: {
    updateRouteHook?: (route: any) => void;
  }
) {
  try {
    // Log the route structure for debugging
    console.log('Executing route:', route);
    
    // Check if the route has the expected structure
    if (!route || typeof route !== 'object') {
      throw new Error('Invalid route structure');
    }
    
    // Execute the route
    const result = await lifiExecuteRoute(route, options);
    
    return result;
  } catch (error: any) {
    console.error('LiFi execution error:', error);
    
    // Try to provide more specific error messages
    if (error.message?.includes('length')) {
      throw new Error('Invalid route structure. The quote may not be executable.');
    }
    
    throw error;
  }
}