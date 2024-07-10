import React, { useEffect, useState } from 'react';
import { Transaction, PrivateKey, PublicKey, Hash, P2PKH, SatoshisPerKilobyte, MerklePath, TransactionInput } from '@bsv/sdk'
import { Ticket, HashedTicket } from './TicketCreator';
import { TextField, Button, Typography, List, ListItem, ListItemText, Paper, Grid, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Checkbox } from '@mui/material';
import { on } from 'events';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';



interface Props {
  hashedTickets: HashedTicket[];
  creatorKey: PrivateKey;
  creatorKeys: PrivateKey[];
  hmacKey: string;
  prevTx: Transaction;
  prevTxMerklePath: string;
  prevTxOutputIndex: number;
  tickets: Ticket[];
  distTicks: Ticket[];
  distHashedTicks: HashedTicket[]
  onDistribute: (tx: Transaction, index: number, distributorKeys: PrivateKey[]) => void;
  onSelectDistributedTickets: (tickets: Ticket[]) => void;
  onHashDistributedTickets: (hashedTickets: HashedTicket[]) => void;
}


const Distributor: React.FC<Props> = ({ prevTxOutputIndex, prevTxMerklePath, hashedTickets, creatorKey, creatorKeys, hmacKey,
  prevTx, tickets, distTicks, distHashedTicks, onDistribute, onSelectDistributedTickets, onHashDistributedTickets }) => {

  const [privateKey] = useState<PrivateKey>(new PrivateKey());
  const [distributedTickets, setDistributedTickets] = useState<Ticket[]>(distTicks);
  const [distributedHashedTickets, setDistributedHashedTickets] = useState<HashedTicket[]>(distHashedTicks);
  const [selectedTickets, setSelectedTickets] = useState<Set<number>>(new Set());
  const [distributorTx, setDistributorTx] = useState<Transaction>(new Transaction());
  const [distributorTxInputIndex, setDistributorTxInputIndex] = useState<number>(0);
  const [distributorKeys, setDistributorKeys] = useState<PrivateKey[]>([]);
  const [spvCheck, setSpvCheck] = useState<boolean>();

  useEffect(() => {
    onDistribute(distributorTx, distributorTxInputIndex, distributorKeys);
  }, [onDistribute, distributorTx, distributorTxInputIndex, distributorKeys]);

  const handleSelectTicket = (index: number) => {
    setSelectedTickets(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      return newSelected;
    });
  };

  const handleSelectTicketsForDistribution = () => {
    if (!creatorKey || !hmacKey || !prevTx) return;

    const dTickets: Ticket[] = [];

    selectedTickets.forEach((index) => {
      dTickets.push(tickets[index]);
    });
    setDistributedTickets(dTickets)
    onSelectDistributedTickets(dTickets);
  };

  const handleCreateHashedTickets = () => {

    const newHashedTickets = distributedTickets.map(ticket => ({
      ticket,
      hash: Array.from(Hash.sha256hmac(hmacKey, JSON.stringify(ticket))),
    }));
    setDistributedHashedTickets(newHashedTickets);
    onHashDistributedTickets(newHashedTickets);

  };

  const handleSpvVerification =  () => {
    /*if (!creatorKey || !hmacKey || !prevTx) return;

    const tx = prevTx;
    const merklePath = prevTxMerklePath;

    tx.merklePath = MerklePath.fromHex(merklePath);*/

    //console.log(await tx.verify());
    console.log(true);

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
    selectedTickets.forEach((index) => {
      tx.addInput({
        sourceTransaction: prevTx,
        sourceOutputIndex: index,
        unlockingScriptTemplate: new P2PKH().unlock(creatorKeys[index]),
        sequence: 0xFFFFFFFF,
      });
    });

    tx.addInput({
      sourceTransaction: prevTx,
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
      await tx.fee(new SatoshisPerKilobyte(10));
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

  };

  const handleSubmitTransaction = async () => {
    const tx = distributorTx;

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
      }
    } catch (error) {
      console.error(error);
      return;
    }
  };

  const toHexString = (byteArray: number[]) => {
    return byteArray.map(byte => byte.toString(16).padStart(2, '0')).join(' ');
  };

  const hasInputsOrOutputs = (tx: Transaction | null) => {
    return tx && (tx.inputs.length > 0 || tx.outputs.length > 0);
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
            <TableCell>Selected</TableCell>
            <TableCell>Event Name</TableCell>
            <TableCell>Section</TableCell>
            <TableCell>Row</TableCell>
            <TableCell>Seat</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tickets.map((ticket, idx) => (
            <TableRow key={idx}>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedTickets.has(idx)}
                  onChange={() => handleSelectTicket(idx)}
                />
              </TableCell>
              <TableCell>{ticket.eventName}</TableCell>
              <TableCell>{ticket.section}</TableCell>
              <TableCell>{ticket.row}</TableCell>
              <TableCell>{ticket.seat}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
      <div>
        <Button variant="contained" onClick={handleSelectTicketsForDistribution} style={{ marginTop: '16px' }}>
          Select Tickets for Distribution
        </Button>
      </div>
    </Grid>
    <Grid item xs={6}>
      <Typography variant="h6" gutterBottom style={{ marginTop: '16px' }}>
        Selected Tickets
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
            {distributedTickets.map((ticket, idx) => (
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
      <div>
        <Button variant="contained" onClick={handleCreateHashedTickets} style={{ marginTop: '16px' }}>
          Hash Selected Tickets
        </Button>
      </div>
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
    </Grid>
    </Grid>
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