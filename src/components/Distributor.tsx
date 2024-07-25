import React, { useEffect, useState } from 'react';
import { Transaction, PrivateKey, Hash, P2PKH, SatoshisPerKilobyte, MerklePath, PublicKey } from '@bsv/sdk'
import { Ticket, HashedTicket } from './Creator';
import { Button, Typography, Paper, Grid, TableContainer, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import JSONPretty from 'react-json-pretty';
import { toHexString, hasInputsOrOutputs, handleSubmitTx, getMerklePath, createHashedTickets,
  spvVerification
 } from './UtilityFunctions';
import 'react-json-pretty/themes/monikai.css';
import 'prismjs/themes/prism-tomorrow.css';
import { on } from 'events';



interface Props {
  hashedTickets: HashedTicket[];
  creatorKey: PrivateKey;
  creatorKeys: PrivateKey[];
  hmacKey: string;
  cTx: Transaction;
  creatorTxMerklePath: string;
  creatorTxOutputIndex: number;
  tickets: Ticket[];
  distHashedTicks: HashedTicket[];
  numDistributorKeys: number;
  distPrivKeys: PrivateKey[];
  distPubKeys: PublicKey[];
  onDistribute: (tx: Transaction, index: number, distributorKeys: PrivateKey[]) => void;
  onSelectDistributedTickets: (tickets: Ticket[]) => void;
  onHashDistributedTickets: (hashedTickets: HashedTicket[]) => void;
  onGetMerklePath: (merklePath: string) => void;
  onCreateDistributorKeys: (distributorPrivKeys: PrivateKey[], distributorPubKeys: PublicKey[]) => void;
}


const Distributor: React.FC<Props> = ({ creatorTxOutputIndex: prevTxOutputIndex, creatorTxMerklePath, hashedTickets, 
  creatorKey, creatorKeys, hmacKey: hmac, cTx, tickets, distHashedTicks, numDistributorKeys, distPrivKeys, distPubKeys, 
  onDistribute, onSelectDistributedTickets, onHashDistributedTickets, onGetMerklePath, onCreateDistributorKeys }) => {

  const [privateKey] = useState<PrivateKey>(new PrivateKey());
  const [distributorHashedTickets, setDistributorHashedTickets] = useState<HashedTicket[]>(distHashedTicks);
  const [distributorTx, setDistributorTx] = useState<Transaction>(new Transaction());
  const [distributorTxInputIndex, setDistributorTxInputIndex] = useState<number>(0);
  const [distributorPrivKeys, setDistributorPrivKeys] = useState<PrivateKey[]>(distPrivKeys);
  const [distributorPubKeys, setDistributorPubKeys] = useState<PublicKey[]>(distPubKeys);
  const [outputText, setOutputText] = useState<string>("");
  const [distributorTxMerklePath, setDistributorTxMerklePath] = useState<string>("");
  const [creatorTx, setCreatorTx] = useState<Transaction>(cTx);
  const [verifiedTx, setVerifiedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    onDistribute(distributorTx, distributorTxInputIndex, distributorPrivKeys);
  }, [onDistribute, distributorTx, distributorTxInputIndex, distributorPrivKeys]);

  useEffect(() => {
    if (cTx) {
      setCreatorTx(cTx);
    }
  }, [cTx]);


  const handleCreateDistributorKeys = () => {
    const privKeys: PrivateKey[] = [];
    const pubKeys: PublicKey[] = [];
    console.log(numDistributorKeys)
    for (let i = 0; i < numDistributorKeys-1; i++) {
      privKeys[i] = PrivateKey.fromRandom();
      pubKeys[i] = privKeys[i].toPublicKey();
    }
    privKeys[numDistributorKeys-1] = PrivateKey.fromWif('L259sfQyASg5rpjxMHCh1XbaoRYAvkNCzrMSRG3kuVp2bA9YveX8');
    pubKeys[numDistributorKeys-1] = privKeys[numDistributorKeys-1].toPublicKey();
    setDistributorPrivKeys(privKeys);
    setDistributorPubKeys(pubKeys);
    onCreateDistributorKeys(privKeys, pubKeys);
    console.log(JSON.stringify(pubKeys));
  }

  const handleCreateHashedTickets = () => {

    const hashedTickets = createHashedTickets(tickets, hmac)

    setDistributorHashedTickets(hashedTickets);
    onHashDistributedTickets(hashedTickets);

  };

  const handleSpvVerification = async () => {
    if (!creatorTx || !creatorTx.inputs || creatorTx.inputs.length === 0) {
      console.log("Creator transaction is not properly initialized");
      setOutputText("Creator transaction is not properly initialized");
      return;
    }
  
    try {
      console.log("Creator TX:", creatorTx);
      console.log("Creator TX Inputs:", creatorTx.inputs);
      console.log("Creator TX Outputs:", creatorTx.outputs);
  
      if (!creatorTx.inputs[0].sourceTransaction) {
        console.log("Source transaction is missing");
        setOutputText("Source transaction is missing");
        return;
      }
  
      console.log("Source Transaction Merkle Path:", creatorTx.inputs[0].sourceTransaction.merklePath?.toHex());
  
      // Manually construct the transaction hex using BigInt
      const version = BigInt(creatorTx.version).toString(16).padStart(8, '0');
      const inputCount = creatorTx.inputs.length.toString(16).padStart(2, '0');
      const outputCount = creatorTx.outputs.length.toString(16).padStart(2, '0');
      const lockTime = BigInt(creatorTx.lockTime).toString(16).padStart(8, '0');
  
      let inputsHex = '';
      creatorTx.inputs.forEach(input => {
        inputsHex += (input.sourceTransaction?.id('hex') || '0'.repeat(64)) +
                     BigInt(input.sourceOutputIndex || 0).toString(16).padStart(8, '0') +
                     '00' + // Empty unlocking script for now
                     'ffffffff'; // Sequence
      });
  
      let outputsHex = '';
      creatorTx.outputs.forEach(output => {
        outputsHex += BigInt(output.satoshis || 0).toString(16).padStart(16, '0') +
                      (output.lockingScript?.toHex() || '');
      });
  
      const txHex = version + inputCount + inputsHex + outputCount + outputsHex + lockTime;
      console.log("Manually constructed Transaction Hex:", txHex);
  
      const tx = Transaction.fromHex(creatorTx.inputs[0].sourceTransaction?.merklePath?.toHex() || '');
      const verificationResult = await spvVerification(tx);
  
      if (verificationResult) {
        console.log('SPV Check Passed', verificationResult);
        setOutputText(`SPV Check Passed: ${JSON.stringify(verificationResult, null, 2)}`);
        setVerifiedTx(tx);
      } else {
        console.error('SPV Check Failed');
        setOutputText('SPV Check Failed');
      }
    } catch (error) {
      console.error('SPV Verification error:', error);
      setOutputText(`SPV Check Error: ${error}`);
    }
  };

  const handleIntegrityCheck = () => {
    const recreatedHashes = createHashedTickets(tickets, hmac);
    const integrityPassed = recreatedHashes.every((hash, index) => 
      hash.hash.toString() === hashedTickets[index].hash.toString()
    );

    if (integrityPassed) {
      console.log('Integrity Check Passed');
      setOutputText('Integrity Check Passed');
    } else {
      console.error('Integrity Check Failed');
      setOutputText('Integrity Check Failed');
    }
    return integrityPassed;
  };
  

  const handleClearTx = () => {
    setDistributorTx(new Transaction());
  };
  const handleAddOutputs = () => {

    const tx = distributorTx;
    const keys: PrivateKey[] = [];
    if (keys.length < 1) {
      const ks: PrivateKey[] = [];
      for(let i = 0; i < distributorHashedTickets.length; i++) {
        ks.push(PrivateKey.fromRandom());
      }
      for (let i = 0; i < distributorHashedTickets.length; i++) {
        const key: PrivateKey = PrivateKey.fromString((Hash.sha256hmac(hmac, ks[i].toPublicKey().toHash()+(distributorHashedTickets[i].hash.join(''), 'hex'))).join(''), 'hex');
        keys.push(key);
        tx.addOutput({
          lockingScript: new P2PKH().lock(key.toAddress()),
          satoshis: 1000,
        })
      };
    }

    tx.addOutput({
      lockingScript: new P2PKH().lock(PrivateKey.fromWif('L259sfQyASg5rpjxMHCh1XbaoRYAvkNCzrMSRG3kuVp2bA9YveX8').toAddress()),
      change: true,
    });

    setDistributorPrivKeys(keys);
    setDistributorTx(tx);
    setDistributorTxInputIndex(tx.inputs.length - 1);
    setOutputText(JSON.stringify(tx, null, 2));

  };

  const handleAddInputs = () => {
    if (!creatorKeys) return;
    const tx = distributorTx;
    const ctx = cTx;

    console.log(creatorTxMerklePath);
    ctx.merklePath = MerklePath.fromHex(creatorTxMerklePath);

    tickets.forEach((ticket, index) => {
      tx.addInput({
        sourceTransaction: ctx,
        sourceOutputIndex: index,
        unlockingScriptTemplate: new P2PKH().unlock(creatorKeys[index]),
        sequence: 0xFFFFFFFF,
      });
    });

    tx.addInput({
      sourceTransaction: ctx,
      sourceOutputIndex: prevTxOutputIndex,
      unlockingScriptTemplate: new P2PKH().unlock(PrivateKey.fromWif('L259sfQyASg5rpjxMHCh1XbaoRYAvkNCzrMSRG3kuVp2bA9YveX8')),
      sequence: 0xFFFFFFFF,
    });

    setCreatorTx(ctx);
    setDistributorTx(tx);
    setOutputText(JSON.stringify(tx, null, 2));

  }

  const handleCreateDistributedTransaction = async () => {

    const tx = distributorTx;
    tx.version = 2;

    try {
      await tx.fee(new SatoshisPerKilobyte(1));
      await tx.sign();
    } catch (error) {
      console.error(error);
      return;
    }
    console.log(JSON.stringify({"rawTx": tx.toHex()}));
    setDistributorTx(tx);
    let index = 0;
    if (distributorHashedTickets.length !== 0) {
      index = distributorHashedTickets.length;
    } 
    onDistribute(tx, index, distributorPrivKeys);
    onSelectDistributedTickets(tickets);
    setOutputText(JSON.stringify(tx.toHex(), null, 2));

  };

  const handleSubmitTransaction = async () => {
    if (!verifiedTx) return;

    const result = await handleSubmitTx(verifiedTx);
    console.log('Submitted to ARC:', result);
    setOutputText(`Submitted to ARC: ${JSON.stringify(result, null, 2)}`);

    const merklePath = await getMerklePath(verifiedTx);
    onGetMerklePath(merklePath);
  };

  const createBuyerTemplate = () => {
    if (!verifiedTx) return;

    const template = {
      inputs: verifiedTx.inputs.map((input, index) => ({
        sourceTransaction: input.sourceTransaction?.toHex(),
        sourceOutputIndex: input.sourceOutputIndex,
        sequence: input.sequence,
      })),
      outputs: verifiedTx.outputs.map(output => ({
        satoshis: output.satoshis,
        lockingScriptTemplate: {
          type: 'P2PKH',
          address: 'BUYER_ADDRESS_PLACEHOLDER',
        },
      })),
    };

    setOutputText(JSON.stringify(template, null, 2));
  };


  const handleGetMerklePath = async () => {

    const merklePath = await getMerklePath(distributorTx);
    setDistributorTxMerklePath(merklePath);
    setOutputText(JSON.stringify(merklePath, null, 2));
    onGetMerklePath(merklePath);

  };
  
  return (
    <div>
    <Typography variant="h4" gutterBottom>
      Distributor
    </Typography>
    <Grid container spacing={3}>
    <Grid item xs={6}>
    <Typography variant="h6" gutterBottom style={{ marginTop: '16px' }}>
      Tickets
    </Typography>
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Event Name</TableCell>
            <TableCell>Section</TableCell>
            <TableCell>Row</TableCell>
            <TableCell>Seat</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tickets.map((ticket, idx) => (
            <TableRow key={idx}>
              <TableCell>{ticket.eventName}</TableCell>
              <TableCell>{ticket.section}</TableCell>
              <TableCell>{ticket.row}</TableCell>
              <TableCell>{ticket.seat}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
    </Grid>
    <Grid item xs={6}>
    </Grid>
    <Grid item xs={6}>
      <Typography variant="h6" gutterBottom style={{ marginTop: '16px' }}>
        Supplied Ticket Hashes
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ticket</TableCell>
              <TableCell>Hash</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {hashedTickets.map((hashedTicket, idx) => (
              <TableRow key={idx}>
                <TableCell>{Object.values(hashedTicket.ticket).toString()}</TableCell>
                <TableCell>{toHexString(hashedTicket.hash)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Grid>
    <Grid item xs={6}>
      <Typography variant="h6" gutterBottom style={{ marginTop: '16px' }}>
        Selected Ticket Hashes
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ticket</TableCell>
              <TableCell>Hash</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {distributorHashedTickets.map((hashedTicket, idx) => (
              <TableRow key={idx}>
                <TableCell>{Object.values(hashedTicket.ticket).toString()}</TableCell>
                <TableCell>{toHexString(hashedTicket.hash)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <div>
        <Button variant="contained" onClick={handleCreateHashedTickets} style={{ marginTop: '16px' }}>
          Hash Tickets
        </Button>
      </div>
    </Grid>
    </Grid>
      <div>
        <Button variant="contained" onClick={handleCreateDistributorKeys} style={{ marginTop: '16px' }}>
          Create Distributor Keys
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleSpvVerification} style={{ marginTop: '16px' }}>
          Run SPV Check
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleIntegrityCheck} style={{ marginTop: '16px' }}>
          Run Integrity Check
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleAddInputs} style={{ marginTop: '16px' }}>
          Add Inputs
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleAddOutputs} style={{ marginTop: '16px' }}>
          Add Outputs
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleCreateDistributedTransaction} style={{ marginTop: '16px' }}>
          Create Distributor Transaction
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleSubmitTransaction} style={{ marginTop: '16px' }}>
          Submit Transaciton
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleClearTx} style={{ marginTop: '16px' }}>
          Clear TX
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleGetMerklePath} style={{ marginTop: '16px' }}>
          Get Merkle Path
        </Button>
      </div>
      {hasInputsOrOutputs(distributorTx) && (
        <div style={{ marginTop: '16px' }}>
          <Typography variant="h6" gutterBottom>
            Created Transaction
          </Typography>
          <JSONPretty id="json-pretty" className="json-pretty-container" data={outputText}></JSONPretty>
        </div>
      )}
    </div>
  );
};

export default Distributor;