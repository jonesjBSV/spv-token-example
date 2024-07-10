import React, { useState } from 'react';
import { Transaction, PrivateKey, PublicKey, P2PKH, Hash } from '@bsv/sdk';
import { Button, Typography, List, ListItem, ListItemText, Paper, Table, TableContainer, TableHead, TableRow, TableCell, TableBody, Grid } from '@mui/material';
import { HashedTicket, Ticket } from './TicketCreator';

interface Props {
  buyerTx: Transaction;
  buyerTxOutputIndex: number;
  buyerKey: PrivateKey | null;
  buyerKeys: PrivateKey[];
  hashedTickets: HashedTicket[];
  redeemedTickets: Ticket[];
  hmacKey: string;
  onEventGateEntry: (tx: Transaction, privateKey: PrivateKey, publicKey: PublicKey) => void;
}

const EventGate: React.FC<Props> = ({ buyerKeys, hmacKey, redeemedTickets, hashedTickets, buyerTx, buyerTxOutputIndex, buyerKey }) => {
  const [privateKey] = useState<PrivateKey>(new PrivateKey());
  const [publicKey] = useState<PublicKey>(privateKey.toPublicKey());
  const [redeemedHashedTickets, setRedeemedHashedTickets] = useState<HashedTicket[]>([]);
  const [redeemedTx, setRedeemedTx] = useState<Transaction>(new Transaction());

  const redeemTicket = () => {
    if (!buyerTx || !buyerKey) return;

    handleHashRedeemedTickets();
    handleAddInputs();
    handleAddOutputs();

    const newTx = new Transaction();

    newTx.addInput({
      sourceTransaction: buyerTx,
      sourceOutputIndex: 0,
      unlockingScriptTemplate: new P2PKH().unlock(buyerKey),
      sequence: 0xFFFFFFFF,
    });

    newTx.addOutput({
      lockingScript: new P2PKH().lock(publicKey.toAddress()),
      satoshis: 3
    });

  };

  const handleAddInputs = () => {
    if (!buyerKeys) return;
    const tx = redeemedTx;
    redeemedTickets.forEach((ticket, index) => {
      tx.addInput({
        sourceTransaction: buyerTx,
        sourceOutputIndex: index+2,
        unlockingScriptTemplate: new P2PKH().unlock(buyerKeys[index]),
        sequence: 0xFFFFFFFF,
      });
    });

    tx.addInput({
      sourceTransaction: buyerTx,
      sourceOutputIndex: buyerTxOutputIndex,
      unlockingScriptTemplate: new P2PKH().unlock(PrivateKey.fromWif('L259sfQyASg5rpjxMHCh1XbaoRYAvkNCzrMSRG3kuVp2bA9YveX8')),
      sequence: 0xFFFFFFFF,
    });

    setRedeemedTx(tx);

  }

  const clearRedeemedTransaction = () => {
    setRedeemedTx(new Transaction());
  };

  const handleAddOutputs = () => {
    const tx = redeemedTx;
    const keys: PrivateKey[] = [];
    if (keys.length < 1) {
      const ks: PrivateKey[] = [];
      for(let i = 0; i < redeemedHashedTickets.length; i++) {
        ks.push(PrivateKey.fromRandom());
      }
      for (let i = 0; i < redeemedHashedTickets.length; i++) {
        const key: PrivateKey = PrivateKey.fromString((Hash.sha256hmac(hmacKey, ks[i].toPublicKey().toHash()+(redeemedHashedTickets[i].hash.join(''), 'hex'))).join(''), 'hex');
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
  };

  const handleHashRedeemedTickets = () => {
    const rHashedTickets = redeemedTickets.map(ticket => ({
      ticket,
      hash: Array.from(Hash.sha256hmac(hmacKey, JSON.stringify(ticket)))
    }));
    setRedeemedHashedTickets(rHashedTickets);

  };

  const toHexString = (byteArray: number[]) => {
    return byteArray.map(byte => byte.toString(16).padStart(2, '0')).join(' ');
  };


  const handleSubmitTransaction = async () => {
    const tx = redeemedTx;

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
  
  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Event Gate
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
          {redeemedTickets.map((ticket, idx) => (
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
            {redeemedHashedTickets.map((hashedTicket, idx) => (
              <TableRow key={idx}>
                <TableCell>{Object.values(hashedTicket.ticket).toString()}</TableCell>
                <TableCell>{toHexString(hashedTicket.hash)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Grid>
    </Grid>
    <div>
      <Button variant="contained" color="primary" onClick={redeemTicket} style={{ marginTop: '16px' }}>
        Redeem Ticket(s)
      </Button>
    </div>
    <div>
      <Button variant="contained" color="primary" onClick={clearRedeemedTransaction} style={{ marginTop: '16px' }}>
        Clear Transaction
      </Button>
    </div>
    <div>
      <Button variant="contained" color="primary" onClick={handleSubmitTransaction} style={{ marginTop: '16px' }}>
        Clear Transaction
      </Button>
    </div>
    </div>
  );
};

export default EventGate;
