import React, { useEffect, useState } from 'react';
import { Transaction, PrivateKey, Hash, P2PKH, SatoshisPerKilobyte, MerklePath, defaultChainTracker } from '@bsv/sdk'
import { Ticket, HashedTicket } from './Creator';
import { Button, Typography, Paper, Grid, TableContainer, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import 'prismjs/themes/prism-tomorrow.css';
import { toHexString, hasInputsOrOutputs, handleSubmitTx, getMerklePath, createHashedTickets,
  spvVerification
 } from './UtilityFunctions';



interface Props {
  hashedTickets: HashedTicket[];
  creatorKey: PrivateKey;
  creatorKeys: PrivateKey[];
  hmacKey: string;
  creatorTx: Transaction;
  creatorTxMerklePaths: string[];
  creatorTxOutputIndex: number;
  tickets: Ticket[];
  distHashedTicks: HashedTicket[]
  onDistribute: (tx: Transaction, index: number, distributorKeys: PrivateKey[]) => void;
  onSelectDistributedTickets: (tickets: Ticket[]) => void;
  onHashDistributedTickets: (hashedTickets: HashedTicket[]) => void;
  onGetMerklePath: (merklePath: string) => void;
}


const Distributor: React.FC<Props> = ({ creatorTxOutputIndex: prevTxOutputIndex, creatorTxMerklePaths, hashedTickets, creatorKey, creatorKeys, hmacKey: hmac,
  creatorTx, tickets, distHashedTicks, onDistribute, onSelectDistributedTickets, onHashDistributedTickets, onGetMerklePath }) => {

  const [privateKey] = useState<PrivateKey>(new PrivateKey());
  const [distributorHashedTickets, setDistributorHashedTickets] = useState<HashedTicket[]>(distHashedTicks);
  const [distributorTx, setDistributorTx] = useState<Transaction>(new Transaction());
  const [distributorTxInputIndex, setDistributorTxInputIndex] = useState<number>(0);
  const [distributorKeys, setDistributorKeys] = useState<PrivateKey[]>([]);
  const [outputText, setOutputText] = useState<string>("");
  const [distributorTxMerklePath, setDistributorTxMerklePath] = useState<string>("");
  const [ctx, setCtx] = useState<Transaction>(creatorTx);

  useEffect(() => {
    onDistribute(distributorTx, distributorTxInputIndex, distributorKeys);
  }, [onDistribute, distributorTx, distributorTxInputIndex, distributorKeys]);


  const handleCreateHashedTickets = () => {

    const hashedTickets = createHashedTickets(tickets, hmac)

    setDistributorHashedTickets(hashedTickets);
    onHashDistributedTickets(hashedTickets);

  };

  const handleSpvVerification = async () => {
    if (!creatorTx || !creatorTxMerklePaths) {
      console.log("No creator transaction or merkle path");
      return;
    }
  
    try {
      const tx = creatorTx;
      const merklePath = MerklePath.fromHex(creatorTxMerklePaths[0]);
      tx.merklePath = merklePath;
  
      // Verify the merkle proof
      const isValidMerkleProof = await tx.verify("scripts only", new SatoshisPerKilobyte(1));
      if (!isValidMerkleProof) {
        console.error('Invalid merkle proof');
        setOutputText('SPV Check Failed: Invalid merkle proof');
        return;
      }
  
      // Verify the transaction
      const verificationResult = await tx.verify('scripts only', new SatoshisPerKilobyte(1));
      
      if (verificationResult) {
        console.log('SPV Check Passed:', verificationResult);
        setOutputText(`SPV Check Passed: ${JSON.stringify(verificationResult, null, 2)}`);
      } else {
        console.error('SPV Check Failed:', verificationResult);
        setOutputText(`SPV Check Failed: ${JSON.stringify(verificationResult, null, 2)}`);
      }
    } catch (error) {
      console.error('SPV Verification error:', error);
      setOutputText(`SPV Check Error: ${error}`);
    }
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

    setDistributorKeys(keys);
    setDistributorTx(tx);
    setDistributorTxInputIndex(tx.inputs.length - 1);
    setOutputText(JSON.stringify(tx, null, 2));

  };

  const handleAddInputs = () => {
    if (!creatorKeys) return;
    const tx = distributorTx;
    const ctx = creatorTx;

    console.log(creatorTxMerklePaths[0]);
    ctx.merklePath = MerklePath.fromHex(creatorTxMerklePaths[0]);

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

    setCtx(ctx);
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
    onDistribute(tx, index, distributorKeys);
    onSelectDistributedTickets(tickets);
    setOutputText(JSON.stringify(tx.toHex(), null, 2));

  };

  const handleSubmitTransaction = async () => {

    const result = await handleSubmitTx(distributorTx);
    setOutputText(JSON.stringify(result, null, 2));

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
        <Button variant="contained" onClick={handleSpvVerification} style={{ marginTop: '16px' }}>
          Run SPV Check
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