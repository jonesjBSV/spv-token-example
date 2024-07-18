import React, { useState } from 'react';
import { Transaction, PrivateKey, PublicKey, P2PKH, Hash, SatoshisPerKilobyte } from '@bsv/sdk';
import { Button, Typography, List, ListItem, ListItemText, Paper, Table, TableContainer, TableHead, TableRow, TableCell, TableBody, Grid } from '@mui/material';
import { HashedTicket, Ticket } from './Creator';
import { handleSubmitTx, hasInputsOrOutputs, toHexString } from './utilityFunctions';
import JSONPretty from 'react-json-pretty';

interface Props {
  buyerTx: Transaction;
  buyerTxOutputIndex: number;
  buyerKey: PrivateKey | null;
  buyerKeys: PrivateKey[];
  hashedTickets: HashedTicket[];
  buyerIndexes: Set<number>;
  buyerTickets: Ticket[];
  hmacKey: string;
  buyerTxMerklePath: string;
  onEventGateEntry: (tx: Transaction, privateKey: PrivateKey, publicKey: PublicKey) => void;
  onGetMerklePath: (merklePath: string) => void;
}

const EventGate: React.FC<Props> = ({ buyerKeys, hmacKey, buyerTickets, buyerIndexes, hashedTickets, buyerTx, buyerTxOutputIndex, buyerKey }) => {
  const [privateKey] = useState<PrivateKey>(new PrivateKey());
  const [publicKey] = useState<PublicKey>(privateKey.toPublicKey());
  const [redeemedHashedTickets, setRedeemedHashedTickets] = useState<HashedTicket[]>([]);
  const [redeemedTx, setRedeemedTx] = useState<Transaction>(new Transaction());
  const [redeemedKeys, setRedeemedKeys] = useState<PrivateKey[]>([]);
  const [outputText, setOutputText] = useState<string>("");

  const redeemTicket = () => {
    if (!buyerTx || !buyerKey) return;

  };

  const handleAddInputs = () => {
    if (!buyerKeys) return;
    const tx = redeemedTx;

    console.log(buyerTx.outputs.length - (buyerTickets.length + 1));
    console.log(buyerTx.outputs.length - 1);
    buyerTickets.forEach((ticket, index) => {
      tx.addInput({
        sourceTransaction: buyerTx,
        sourceOutputIndex: buyerTx.outputs.length - (buyerTickets.length + 1),
        unlockingScriptTemplate: new P2PKH().unlock(buyerKeys[index]),
        sequence: 0xFFFFFFFF,
      });
    });

    tx.addInput({
      sourceTransaction: buyerTx,
      sourceOutputIndex: buyerTx.outputs.length - 1,
      unlockingScriptTemplate: new P2PKH().unlock(PrivateKey.fromWif('L259sfQyASg5rpjxMHCh1XbaoRYAvkNCzrMSRG3kuVp2bA9YveX8')),
      sequence: 0xFFFFFFFF,
    });

    setRedeemedTx(tx);
    setOutputText(JSON.stringify(tx));

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

    setRedeemedKeys(keys);
    setRedeemedTx(tx);
    setOutputText(JSON.stringify(tx));
  };

  const handleCreateRedeemedTransaction = async () => {

    const tx = redeemedTx;

    tx.version = 2;

    try {
      await tx.fee(new SatoshisPerKilobyte(1));
      await tx.sign();
    } catch (error) {
      console.error(error);
      return;
    }
    console.log(JSON.stringify({"rawTx": tx.toHex()}));
    setRedeemedTx(tx);

  };




  const handleHashRedeemedTickets = () => {
    const rHashedTickets = buyerTickets.map(ticket => ({
      ticket,
      hash: Array.from(Hash.sha256hmac(hmacKey, JSON.stringify(ticket)))
    }));
    setRedeemedHashedTickets(rHashedTickets);

  };
  const handleSubmitTransaction = async () => {
    handleSubmitTx(redeemedTx);
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
            <TableCell>Event Name</TableCell>
            <TableCell>Section</TableCell>
            <TableCell>Row</TableCell>
            <TableCell>Seat</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {buyerTickets.map((ticket, idx) => (
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
    <div>
      <Button variant="contained" color="primary" onClick={handleHashRedeemedTickets} style={{ marginTop: '16px' }}>
        Hash Tickets
      </Button>
    </div>
    </Grid>
    </Grid>
    <div>
      <Button variant="contained" color="primary" onClick={handleAddInputs} style={{ marginTop: '16px' }}>
        Add Inputs
      </Button>
    </div>
    <div>
      <Button variant="contained" color="primary" onClick={handleAddOutputs} style={{ marginTop: '16px' }}>
        Add Outputs
      </Button>
    </div>
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
        <Button variant="contained" onClick={handleCreateRedeemedTransaction} style={{ marginTop: '16px' }}>
          Create Redeem Transaction
        </Button>
      </div>
    <div>
      <Button variant="contained" color="primary" onClick={handleSubmitTransaction} style={{ marginTop: '16px' }}>
        Submit Transaction
      </Button>
    </div>
      {hasInputsOrOutputs(redeemedTx) && (
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

export default EventGate;
