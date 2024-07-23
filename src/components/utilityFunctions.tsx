import { ChainTracker, defaultChainTracker, Hash, MerklePath, SatoshisPerKilobyte, Transaction, WhatsOnChain } from '@bsv/sdk';
import { HashedTicket, Ticket } from './Creator';

export const toHexString = (byteArray: number[]) => {
    return byteArray.map(byte => byte.toString(16).padStart(2, '0')).join(' ');
  };

export const hasInputsOrOutputs = (tx: Transaction | null) => {
    return tx && (tx.inputs.length > 0 || tx.outputs.length > 0);
  };

export const handleSubmitTx = async (tx: Transaction): Promise<string> => {

    try {
      const response = await fetch('http://localhost:9090/v1/tx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain',
        },
        body: JSON.stringify({
          "rawTx": tx.toHexEF(),
        })
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      } else {
        const responseData = await response.json();
        console.log(responseData);
        return responseData;
      }
    } catch (error) {
      console.error(error);
      return error as string;
    }
  };

export  const getMerklePath = async (tx: Transaction): Promise<string> => {

    try {
      const response = await fetch('http://localhost:9090/v1/tx/'+tx.id('hex'), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error(error);
      return error as string;
    }

  };

const customFetch = (url: string, options?: RequestInit) => {
  return window.fetch(url, options);
};

export const spvVerification =  async (tx: Transaction): Promise<boolean> => {

  try {
    
    const result = await tx.verify("scripts only", new SatoshisPerKilobyte(1));
     
    console.log(result.valueOf());
    //console.log(await tx.verify());
    //const  result = await tx.verify(new WhatsOnChain("test", ));
    //console.log(result);
    return result;
  } catch (error) {
    console.error(error);
    return false;
  }

}

export  const createHashedTickets = (tickets: Ticket[], hmac: string): HashedTicket[] => {

    const hashedTickets = tickets.map(ticket => ({
      ticket,
      hash: Array.from(Hash.sha256hmac(hmac, JSON.stringify(ticket))),
    }));

    return hashedTickets;

  };

