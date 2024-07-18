import React, { useState, useEffect } from 'react';
import { Transaction, PrivateKey, TransactionInput, Hash, P2PKH, ARC, SatoshisPerKilobyte } from '@bsv/sdk'
import { TextField, Button, Typography, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper, Grid } from '@mui/material';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { toHexString, hasInputsOrOutputs, handleSubmitTx, handleGetMerkP} from './utilityFunctions';

interface Props {
  onTransactionSigned: (privateKey: PrivateKey, hmacKey: string) => void;
  onTransactionCreated: (tx: Transaction, creatorKeys: PrivateKey[], prevTxOutputIndex: number) => void;
  onTicketsCreated: (tickets: Ticket[]) => void;
  onTicketsHashed: (hashedTickets: HashedTicket[]) => void;
  onGetMerklePath: (merklePath: string) => void;
  ticks: Ticket[];
  hashedTicks: HashedTicket[];
  createdTx: Transaction;
}

export interface Ticket {
  eventName: string;
  section: string;
  row: string;
  seat: string;
}

export interface HashedTicket {
  ticket: Ticket;
  hash: number[];
}

const TicketCreator: React.FC<Props> = ({ onGetMerklePath, onTransactionSigned, onTransactionCreated, onTicketsCreated, onTicketsHashed, ticks, hashedTicks, createdTx }) => {
  const [eventName, setEvent] = useState('');
  const [section, setSection] = useState('');
  const [row, setRow] = useState('');
  const [seat, setSeat] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>(ticks);
  const [privateKey] = useState<PrivateKey>(new PrivateKey());
  const [hmacKey] = useState<string>(PrivateKey.fromRandom().toString());
  const [hashedTickets, setHashedTickets] = useState<HashedTicket[]>(hashedTicks);
  const [prevTx, setPrevTx] = useState<Transaction>(new Transaction());
  const [prevTxOutputIndex, setPrevTxOutputIndex] = useState<number>(0);
  const [inputs, setInputs] = useState<TransactionInput[]>([]);
  const [sourceTransaction, setSourceTransaction] = useState<string>("");
  const [sourceOutputIndex, setSourceOutputIndex] = useState<number>(0);
  const [inputTxPrivKey, setInputTxPrivKey] = useState('');
  const [sequence, setSequence] = useState<string>('0xFFFFFFFF');
  const [creatorKeys, setCreatorKeys] = useState<PrivateKey[]>([]);
  const [prevTxMerklePath, setPrevTxMerklePath] = useState<string>("");
  const [outputText, setOutputText] = useState<string>("");

  useEffect(() => {
    onTransactionSigned(privateKey, hmacKey);
  }, [onTransactionSigned, privateKey, hmacKey]);

  const handleAddTicket = () => {
    const newTicket: Ticket = { eventName, section, row, seat };
    setTickets([...tickets, newTicket]);
  };

  const handleCreateHashedTickets = () => {

    onTicketsCreated(tickets);

    const newHashedTickets = tickets.map(ticket => ({
      ticket,
      hash: Array.from(Hash.sha256hmac(hmacKey, JSON.stringify(ticket))),
    }));
    setHashedTickets(newHashedTickets);
    onTicketsHashed(newHashedTickets);
  };

  const handleAddOutputs = () => {
    const tx = prevTx;
    const keys = creatorKeys;
    if (keys.length < 1) {
      const ks: PrivateKey[] = [];
      for(let i = 0; i < hashedTickets.length; i++) {
        ks.push(PrivateKey.fromRandom());
      }
      for(let i = 0; i < hashedTickets.length; i++) { 
        const key: PrivateKey = PrivateKey.fromString((Hash.sha256hmac(hmacKey, ks[i].toPublicKey().toHash()+(hashedTickets[i].hash.join(''), 'hex'))).join(''), 'hex');
        keys.push(key)
        tx.addOutput({
          lockingScript: new P2PKH().lock(key.toAddress()),
          satoshis: 1000,
        });
      };
    }
    // add change output
    tx.addOutput({
        lockingScript: new P2PKH().lock(PrivateKey.fromWif('L259sfQyASg5rpjxMHCh1XbaoRYAvkNCzrMSRG3kuVp2bA9YveX8').toAddress()),
        change: true
    });
    setCreatorKeys(keys);
    setPrevTx(tx);
    setOutputText(JSON.stringify(tx, null, 2));
    if(hashedTickets.length !== 0) {
      setPrevTxOutputIndex(hashedTickets.length + 1);
    }
    onTransactionSigned(privateKey, hmacKey);
  }
  
  const handleAddInput = () => {
    console.log(inputTxPrivKey)
    const newInput: TransactionInput = {
      sourceTransaction: Transaction.fromHex(sourceTransaction),
      sourceOutputIndex: sourceOutputIndex,
      unlockingScriptTemplate: new P2PKH().unlock(PrivateKey.fromWif(inputTxPrivKey)),
      sequence: parseInt(sequence, 16),
    };

    const tx = prevTx;
    tx.addInput(newInput);
    
    /*HeysetInputs([...inputs, newInput]);
    setSourceTransaction("");
    setSourceOutputIndex(0);
    setInputTxPrivKey('');
    setSequence('0xFFFFFFFF');*/

    setPrevTx(tx);
    setOutputText(JSON.stringify(tx, null, 2));
    onTransactionSigned(privateKey, hmacKey);
  };


  const handleCreateTranche = async () => {

    const tx = prevTx
    tx.version = 2;

    // Ensure the transaction has inputs and outputs
    if (tx.inputs.length === 0 || tx.outputs.length === 0) {
      throw new Error('Transaction must have at least one input and one output');
    }

    tx.version = 2;

    // Calc fee
    await tx.fee(new SatoshisPerKilobyte(1));

    try {
      await tx.sign();
    } catch (error) {
      console.error(error);
      return;
    }

    console.log(JSON.stringify({
      "rawTx": tx.toHex()}
    ));
    setPrevTx(tx);
    let index = 0;
    if (hashedTickets.length !== 0) {
      index = hashedTickets.length;
    } 
    setOutputText(JSON.stringify({
      "rawTx": tx.toHex()
    }, null, 2));

    onTransactionCreated(tx, creatorKeys, index);
    onTransactionSigned(privateKey, hmacKey);

  }

  const handleClearTx = () => {
    setPrevTx(new Transaction());
  }

  const handleSubmitTransaction = async () => {
    handleSubmitTx(prevTx);
    setOutputText(JSON.stringify(prevTx.toHex(), null, 2));
  };


  const handleGetMerklePath = async () => {
    const merklePath = await handleGetMerkP(prevTx);
    setPrevTxMerklePath(merklePath);
    setOutputText(JSON.stringify(merklePath, null, 2));
  };

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Ticket Creator
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={6}>
          <div>
            <TextField
              label="Event Name"
              value={eventName}
              onChange={e => setEvent(e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Section"
              value={section}
              onChange={e => setSection(e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Row"
              value={row}
              onChange={e => setRow(e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Seat"
              value={seat}
              onChange={e => setSeat(e.target.value)}
              fullWidth
              margin="normal"
            />
            <Button variant="contained" color="primary" onClick={handleAddTicket} style={{ marginTop: '16px' }}>
              Add Ticket
            </Button>
          </div>
          <div style={{ marginTop: '32px' }}>
            <Typography variant="h6" gutterBottom>
              Add Input
            </Typography>
            <TextField
              label="Source Transaction (Hex)"
              value={sourceTransaction}
              onChange={e => setSourceTransaction(e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Source Output Index"
              type="number"
              value={sourceOutputIndex}
              onChange={e => setSourceOutputIndex(Number(e.target.value))}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Private Key (WIF)"
              value={inputTxPrivKey}
              onChange={e => setInputTxPrivKey(e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Sequence"
              value={sequence}
              onChange={e => setSequence(e.target.value)}
              fullWidth
              margin="normal"
            />
            <Button variant="contained" color="primary" onClick={handleAddInput} style={{ marginTop: '16px' }}>
              Add Input
            </Button>
          </div>
        </Grid>
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
      <Button variant="contained" onClick={handleCreateHashedTickets} style={{ marginTop: '16px' }}>
        Create Hashed Tickets
      </Button>
      <Typography variant="h6" gutterBottom style={{ marginTop: '16px' }}>
        Hashed Tickets
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
      <div>
        <Button variant="contained" onClick={handleAddOutputs} style={{ marginTop: '16px' }}>
          Add Outputs
        </Button>
      </div>
    </Grid>
    </Grid>
      <div>
        <Button variant="contained" onClick={handleCreateTranche} style={{ marginTop: '16px' }}>
          Create Ticket Tranche
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleSubmitTransaction} style={{ marginTop: '16px' }}>
          Submit Transaction
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleGetMerklePath} style={{ marginTop: '16px' }}>
          Get Merkle Path
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleClearTx} style={{ marginTop: '16px' }}>
          Clear TX
        </Button>
      </div>
      {hasInputsOrOutputs(prevTx) && (
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

export default TicketCreator;
