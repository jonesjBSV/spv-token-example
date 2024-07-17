import { Transaction } from '@bsv/sdk';
import React, { useState } from'react';

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
