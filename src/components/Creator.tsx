import React, { useState, useEffect } from 'react';
import { Transaction, PrivateKey, PublicKey, Hash, P2PKH, SatoshisPerKilobyte, TransactionInput, MerklePath } from '@bsv/sdk';
import { TextField, Button, Typography, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper, Grid, Checkbox } from '@mui/material';
import JSONPretty from 'react-json-pretty';
import { toHexString, hasInputsOrOutputs, handleSubmitTx, getMerklePath, createHashedTickets } from './UtilityFunctions';
import 'react-json-pretty/themes/monikai.css';
import 'prismjs/themes/prism-tomorrow.css';

interface Props {
  ticks: Ticket[];
  hashedTicks: HashedTicket[];
  creatorTranches: Tranche[];
  distPubKeys: PublicKey[];
  onTransactionSigned: (privateKey: PrivateKey, hmacKey: string) => void;
  onTicketsCreated: (tickets: Ticket[]) => void;
  onTicketsHashed: (hashedTickets: HashedTicket[]) => void;
  onGetMerklePath: (merklePath: string) => void;
  onTrancheCreated: (tranches: Tranche[]) => void;
  onRequestDistributorPubKeys: (numKeys: number) => void;
  onDistributorTxCreated: (distributorTx: Transaction) => void;
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

export interface Tranche {
  tx: Transaction;
  merklePath: string;
  hashedTickets: HashedTicket[];
}

const TicketCreator: React.FC<Props> = ({ onGetMerklePath, onTransactionSigned, onDistributorTxCreated, onTicketsCreated, onTicketsHashed, onTrancheCreated,
    onRequestDistributorPubKeys, ticks, hashedTicks, creatorTranches, distPubKeys }) => {
  const [eventName, setEvent] = useState('');
  const [section, setSection] = useState('');
  const [row, setRow] = useState('');
  const [seat, setSeat] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>(ticks);
  const [privateKey] = useState<PrivateKey>(new PrivateKey());
  const [hmacKey] = useState<string>(PrivateKey.fromRandom().toString());
  const [hashedTickets, setHashedTickets] = useState<HashedTicket[]>(hashedTicks);
  const [creatorTx, setCreatorTx] = useState<Transaction>(new Transaction());
  const [creatorTxOutputIndex, setCreatorTxOutputIndex] = useState<number>(0);
  const [sourceTransaction, setSourceTransaction] = useState<string>("");
  const [sourceOutputIndex, setSourceOutputIndex] = useState<number>(0);
  const [inputTxPrivKey, setInputTxPrivKey] = useState('');
  const [sequence, setSequence] = useState<string>('0xFFFFFFFF');
  const [creatorKeys, setCreatorKeys] = useState<PrivateKey[]>([]);
  const [outputText, setOutputText] = useState<string>("");
  const [tranches, setTranches] = useState<Tranche[]>(creatorTranches);
  const [selectedTranches, setSelectedTranches] = useState<number[]>([]);
  const [distributorTransaction, setDistributorTransaction] = useState<Transaction>(new Transaction());


  useEffect(() => {
    onTransactionSigned(privateKey, hmacKey);
  }, [onTransactionSigned, privateKey, hmacKey]);

  const handleAddTicket = () => {
    const newTicket: Ticket = { eventName, section, row, seat };
    setTickets([...tickets, newTicket]);
  };

  const handleCreateHashedTickets = () => {

    const hashedTickets = createHashedTickets(tickets, hmacKey);
    setHashedTickets(hashedTickets);
    onTicketsHashed(hashedTickets);
    onTicketsCreated(tickets);

  };

  const handleAddOutputs = () => {
    const tx = creatorTx;
    tx.version = 2;
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
    setCreatorTx(tx);
    setOutputText(JSON.stringify(tx, null, 2));
    if(hashedTickets.length !== 0) {
      setCreatorTxOutputIndex(hashedTickets.length);
    }
    onTransactionSigned(privateKey, hmacKey);
  }
  
  const handleAddInput = () => {
    const newInput: TransactionInput = {
      sourceTransaction: Transaction.fromHex(sourceTransaction),
      sourceOutputIndex: sourceOutputIndex,
      unlockingScriptTemplate: new P2PKH().unlock(PrivateKey.fromWif(inputTxPrivKey)),
      sequence: parseInt(sequence, 16),
    };

    const tx = creatorTx;
    tx.version = 2;
    tx.addInput(newInput);

    setCreatorTx(tx);
    setOutputText(JSON.stringify(tx, null, 2));
    onTransactionSigned(privateKey, hmacKey);
  };


  const handleCreateTranche = async () => {
    if (creatorTx.inputs.length === 0 || creatorTx.outputs.length === 0) {
      throw new Error('Transaction must have at least one input and one output');
    }
    const tx = creatorTx
    const tranches$ = tranches;
    tx.version = 2;

    try {

      await tx.fee(new SatoshisPerKilobyte(1));
      await tx.sign();

    const t: Tranche = {
      tx: tx,
      merklePath: "",
      hashedTickets: hashedTickets
    }

    tranches$.push(t);

    setOutputText(JSON.stringify({
      "rawTx": tx.toHex()
    }, null, 2));

    onTransactionSigned(privateKey, hmacKey);

    } catch (error) {
      console.error(error);
      return;
    }

    setTranches(tranches$);
    onTrancheCreated(tranches$);
    setCreatorTx(new Transaction());
    setTickets([]);
    setHashedTickets([]);

  }

  const handleClearTx = () => {
    setCreatorTx(new Transaction());
  }

  const handleTrancheSelection = (index: number) => {
    setSelectedTranches(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  };

  const submitSelectedTranchesToARC = async () => {
    for (const index of selectedTranches) {
      const tranche = tranches[index];
      try {
        const result = await handleSubmitTx(tranche.tx);
        console.log(`Tranche ${index + 1} submitted to ARC:`, result);
      } catch (error) {
        console.error(`Error submitting tranche ${index + 1} to ARC:`, error);
      }
    }
    setOutputText(`Submitted ${selectedTranches.length} tranches to ARC`);
  };


  const getMerklePathsForSelectedTranches = async () => {
    const ts = tranches;
    for (const index of selectedTranches) {
      try {
        const result = await getMerklePath(ts[index].tx);
        ts[index].merklePath = Object.values(result)[3];
        console.log(`Tranche ${index + 1} Merkle Path:`, result);

        const tx2 = ts[index].tx.inputs[0].sourceTransaction ?? new Transaction();
        const result2 = await getMerklePath(tx2);
        tx2.merklePath = MerklePath.fromHex(Object.values(result2)[3]);
        console.log(`Tranche ${index + 1} Merkle Path:`, result2);
        if (ts[index].tx.inputs[0] && ts[index].tx.inputs[0].sourceTransaction) {
          const sourceTransaction = ts[index].tx.inputs[0].sourceTransaction;
          if (sourceTransaction) {
            sourceTransaction.merklePath = MerklePath.fromHex(Object.values(result2)[3]);
          }
        }
        
      } catch (error) {
        console.error(`Error Fetching Merkle Path ${index + 1} to ARC:`, error);
      }
    }
    setOutputText(`Fetched ${selectedTranches.length} Merkle Paths`);
    setTranches(ts);
    onTrancheCreated(ts);
  };

  const handleRequestDistributorPublicKeys = () => {
    console.log(selectedTranches[0]);
    console.log(tranches[selectedTranches[0]].tx.outputs.length);
    onRequestDistributorPubKeys(tranches[selectedTranches[0]].tx.outputs.length);
  };

  const handleCreateDistributorTransaction = async () => {
    if (tranches.length === 0 || distPubKeys.length === 0) return;

    const tranche = tranches[selectedTranches[0]];
    tranche.tx.merklePath = MerklePath.fromHex(tranche.merklePath);
    const newTx = new Transaction();
    newTx.version = 2;
    const dPubKeys = distPubKeys;

    for (let index=0; index < tranche.tx.outputs.length; index++) {
      newTx.addInput({
        sourceTransaction: tranche.tx,
        sourceOutputIndex: index,
        unlockingScriptTemplate: new P2PKH().unlock(creatorKeys[index]),
        sequence: parseInt(sequence, 16)
      });
    };
    
    for (let index=0; index < tranche.tx.outputs.length-1; index++) {
      const tKey: PrivateKey = PrivateKey.fromString((Hash.sha256hmac(hmacKey, dPubKeys[index].toHash()+(tranche.hashedTickets[index].hash.join(''), 'hex'))).join(''), 'hex');
      newTx.addOutput({
        lockingScript: new P2PKH().lock(tKey.toAddress()),
        satoshis: 1000,
      });
    };

    if (dPubKeys.length > 0 && dPubKeys[dPubKeys.length - 1] instanceof PublicKey) {
      const lastPubKey = dPubKeys[dPubKeys.length - 1];
      try {
        const address = lastPubKey.toAddress();
        newTx.addOutput({
          lockingScript: new P2PKH().lock(address),
          change: true
        });
      } catch (error) {
        console.error('Error creating address from public key:', error);
      }
    }
    

    // Set merklePath for each input
    // Set merklePath for each input
    newTx.inputs.forEach(input => {
      if (input.sourceTransaction) {
        input.sourceTransaction.merklePath = MerklePath.fromHex(tranche.merklePath);
      }
    });


    console.log(newTx);

    setDistributorTransaction(newTx);
    onDistributorTxCreated(newTx);
  };

  const passTrancheToDistributor = () => {
    if (!distributorTransaction) return;

    const tx = distributorTransaction;
    const tranche = tranches[selectedTranches[0]];
    onDistributorTxCreated(tx);
    onGetMerklePath(tranche.merklePath);
    onTicketsCreated(tickets);
    onTicketsHashed(hashedTickets);
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
        <Button variant="contained" onClick={handleClearTx} style={{ marginTop: '16px' }}>
          Clear TX
        </Button>
      </div>
      


      {hasInputsOrOutputs(creatorTx) && (
        <div style={{ marginTop: '16px' }}>
          <Typography variant="h6" gutterBottom>
            Created Transaction
          </Typography>
          <JSONPretty id="json-pretty" className="json-pretty-container" data={outputText}></JSONPretty>
        </div>
      )}
      <Typography variant="h6" gutterBottom style={{ marginTop: '16px' }}>
        Created Tranches
      </Typography>
      <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Select</TableCell>
                <TableCell>Tranche #</TableCell>
                <TableCell>Transaction ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tranches.map((tranche, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Checkbox
                      checked={selectedTranches.includes(idx)}
                      onChange={() => handleTrancheSelection(idx)}
                    />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{tranche.tx.id('hex')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </TableContainer>
        <div>
          <Button 
            variant="contained" 
            onClick={submitSelectedTranchesToARC} 
            disabled={selectedTranches.length === 0 || selectedTranches.length > 1}
            style={{ marginTop: '16px' }} 
          >
            Submit Selected Tranches to ARC
          </Button>
        </div>
        <div>
          <Button 
            variant="contained" 
            onClick={getMerklePathsForSelectedTranches} 
            disabled={selectedTranches.length === 0 || selectedTranches.length > 1}
            style={{ marginTop: '16px' }} 
          >
            Get Merkle Paths for Selected Tranches
          </Button>
        </div>
        <div>
          <Button 
            variant="contained" 
            onClick={handleRequestDistributorPublicKeys} 
            style={{ marginTop: '16px' }}
            disabled={selectedTranches.length === 0 || selectedTranches.length > 1}
          >
            Request Distributor Public Keys
          </Button>
        </div>
        <div>
          <Button 
            variant="contained" 
            onClick={handleCreateDistributorTransaction} 
            style={{ marginTop: '16px' }}
            disabled={selectedTranches.length === 0}
          >
            Create Distributor Transaction
          </Button>
        </div>
        <div>
          <Button 
            variant="contained" 
            onClick={passTrancheToDistributor} 
            style={{ marginTop: '16px' }}
            disabled={selectedTranches.length === 0}
          >
            Pass Tranche to Distributor
          </Button>
        </div>
    </div>
  );
};

export default TicketCreator;
