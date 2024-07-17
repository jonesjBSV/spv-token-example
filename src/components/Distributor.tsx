import React, { useEffect, useState } from 'react';
import { Transaction, PrivateKey, PublicKey, Hash, P2PKH, SatoshisPerKilobyte, MerklePath, TransactionInput } from '@bsv/sdk'
import { Ticket, HashedTicket } from './TicketCreator';
import { TextField, Button, Typography, List, ListItem, ListItemText, Paper, Grid, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Checkbox } from '@mui/material';
import { on } from 'events';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { toHexString, hasInputsOrOutputs, handleSubmitTx } from './utilityFunctions';



interface Props {
  hashedTickets: HashedTicket[];
  creatorKey: PrivateKey;
  creatorKeys: PrivateKey[];
  hmacKey: string;
  creatorTx: Transaction;
  creatorTxMerklePath: string;
  prevTxOutputIndex: number;
  tickets: Ticket[];
  distTicks: Ticket[];
  distHashedTicks: HashedTicket[]
  onDistribute: (tx: Transaction, index: number, distributorKeys: PrivateKey[]) => void;
  onSelectDistributedTickets: (tickets: Ticket[]) => void;
  onHashDistributedTickets: (hashedTickets: HashedTicket[]) => void;
}


const Distributor: React.FC<Props> = ({ prevTxOutputIndex, creatorTxMerklePath, hashedTickets, creatorKey, creatorKeys, hmacKey,
  creatorTx, tickets, distTicks, distHashedTicks, onDistribute, onSelectDistributedTickets, onHashDistributedTickets }) => {

  const [privateKey] = useState<PrivateKey>(new PrivateKey());
  const [distributedTickets, setDistributedTickets] = useState<Ticket[]>(distTicks);
  const [distributedHashedTickets, setDistributedHashedTickets] = useState<HashedTicket[]>(distHashedTicks);
  const [distributorTx, setDistributorTx] = useState<Transaction>(new Transaction());
  const [distributorTxInputIndex, setDistributorTxInputIndex] = useState<number>(0);
  const [distributorKeys, setDistributorKeys] = useState<PrivateKey[]>([]);
  const [spvCheck, setSpvCheck] = useState<boolean>();

  useEffect(() => {
    onDistribute(distributorTx, distributorTxInputIndex, distributorKeys);
  }, [onDistribute, distributorTx, distributorTxInputIndex, distributorKeys]);


  const handleCreateHashedTickets = () => {

    const newHashedTickets = tickets.map(ticket => ({
      ticket,
      hash: Array.from(Hash.sha256hmac(hmacKey, JSON.stringify(ticket))),
    }));
    setDistributedHashedTickets(newHashedTickets);
    onHashDistributedTickets(newHashedTickets);

  };

  const handleSpvVerification =  async () => {
    if (!creatorKey || !hmacKey || !creatorTx || !creatorTxMerklePath) return;

    const tx = creatorTx;
    const merklePath = creatorTxMerklePath;

    tx.merklePath = MerklePath.fromHex(merklePath);
    const result = await tx.verify();

    console.log(result);

  }

  const handleClearTx = () => {
    setDistributorTx(new Transaction());
  };
  const handleAddOutputs = () => {

    const tx = distributorTx;
    const keys: PrivateKey[] = [];
    if (keys.length < 1) {
      const ks: PrivateKey[] = [];
      for(let i = 0; i < distributedHashedTickets.length; i++) {
        ks.push(PrivateKey.fromRandom());
      }
      for (let i = 0; i < distributedHashedTickets.length; i++) {
        const key: PrivateKey = PrivateKey.fromString((Hash.sha256hmac(hmacKey, ks[i].toPublicKey().toHash()+(distributedHashedTickets[i].hash.join(''), 'hex'))).join(''), 'hex');
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

  };

  const handleAddInputs = () => {
    if (!creatorKeys) return;
    const tx = distributorTx;
    tickets.forEach((ticket, index) => {
      tx.addInput({
        sourceTransaction: creatorTx,
        sourceOutputIndex: index,
        unlockingScriptTemplate: new P2PKH().unlock(creatorKeys[index]),
        sequence: 0xFFFFFFFF,
      });
    });

    tx.addInput({
      sourceTransaction: creatorTx,
      sourceOutputIndex: prevTxOutputIndex,
      unlockingScriptTemplate: new P2PKH().unlock(PrivateKey.fromWif('L259sfQyASg5rpjxMHCh1XbaoRYAvkNCzrMSRG3kuVp2bA9YveX8')),
      sequence: 0xFFFFFFFF,
    });

    //console.log(tx.toHex());
    setDistributorTx(tx);

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
    if (distributedHashedTickets.length !== 0) {
      index = distributedHashedTickets.length;
    } 
    onDistribute(tx, index, distributorKeys);
    onSelectDistributedTickets(tickets);

  };

  const handleSubmitTransaction = async () => {
    await handleSubmitTx(distributorTx);
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
            {distributedHashedTickets.map((hashedTicket, idx) => (
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
        <Button variant="contained" onClick={handleSpvVerification} style={{ marginTop: '16px' }}>
          Run SPV Check
        </Button>
      </div>
      {hasInputsOrOutputs(distributorTx) && (
        <div style={{ marginTop: '16px' }}>
          <Typography variant="h6" gutterBottom>
            Created Transaction
          </Typography>
          <JSONPretty id="json-pretty" className="json-pretty-container" data={JSON.stringify(distributorTx)}></JSONPretty>
        </div>
      )}
    </div>
  );
};

export default Distributor;