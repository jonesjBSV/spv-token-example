import React, { useState } from 'react';
import { Hash, Transaction, PrivateKey, PublicKey, P2PKH, SatoshisPerKilobyte, MerklePath, } from '@bsv/sdk';
import { Button, Typography, Grid, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Checkbox } from '@mui/material';
import { HashedTicket, Ticket } from './Creator';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import 'prismjs/themes/prism-tomorrow.css';
import Prism from 'prismjs';
import { toHexString, handleSubmitTx, getMerklePath } from './UtilityFunctions';

interface Props {
  distributorTx: Transaction;
  distributorKeys: PrivateKey[];
  distributorTickets: Ticket[];
  distributorHashedTickets: HashedTicket[];
  distributorTxInputIndex: number;
  distributorTxMerklePath: string;
  buyerPublicKey: PublicKey | null;
  hmacKey: string;
  onBuy: (tx: Transaction, buyerTxOutputIndex: number, buyerKeys: PrivateKey[], buyer2Keys: PrivateKey[]) => void;
  onSelectBuyerTickets: (buyerTickets: Ticket[], buyerIndexes: Set<number>) => void;
  onGetMerklePath: (merklePath: string) => void;
}

const Buyer: React.FC<Props> = ({ onSelectBuyerTickets, onGetMerklePath, distributorTxMerklePath, distributorTxInputIndex, distributorTx, distributorKeys, distributorTickets, distributorHashedTickets, buyerPublicKey, hmacKey, onBuy }) => {
  const [buyerTickets, setBuyerTickets] = useState<Ticket[]>([]);
  const [buyerHashedTickets, setBuyerHashedTickets] = useState<HashedTicket[]>([]);
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [selectedTickets, setSelectedTickets] = useState<Set<number>>(new Set());
  const [transactionTemplate, setTransactionTemplate] = useState<Transaction | null>(null);
  const [distributorOutputKey, setDistributorOutputKey] = useState<PrivateKey>(PrivateKey.fromRandom());
  const [buyerTx, setBuyerTx] = useState<Transaction | null>(null);
  const [buyerKeys, setBuyerKeys] = useState<PrivateKey[]>([]);
  const [buyer2Keys, setBuyer2Keys] = useState<PrivateKey[]>([]);
  const [buyerTxOutputIndex, setBuyerTxOutputIndex] = useState<number>(0);
  const [buyerTxMerklePath, setBuyerTxMerklePath] = useState<string>("");
  const [outputText, setOutputText] = useState<string>("");

  const prettyPrintJSON = (json: any) => {
    const stringified = JSON.stringify(json, null, 2);
    return (
      <pre className="language-json">
        <code>{Prism.highlight(stringified, Prism.languages.json, 'json')}</code>
      </pre>
    );
  };

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

  const handleGetMerklePath = async () => {
    const merklePath = await getMerklePath(buyerTx as Transaction);
    setBuyerTxMerklePath(merklePath);
    setOutputText(JSON.stringify(merklePath, null, 2));
  };

  const handleRequestTemplate = async () => {
    setTitle("Step 1: Request Transaction Template");
    const template = JSON.stringify({
      "inputs": {
        "0": {
          "transaction": "rawHex()",
          "merklePath": "rawHex()"
        }
      },
      "outputs": {
        "0": {
          "value": "100000000",
          "scriptTemplate": {
            "type": "P2PKH",
            "address": distributorOutputKey.toAddress()
          }
        },
        "n": {
          "...": "..."
        },
      },
      "signature": {
        "SIGHASH_FLAGS": "SIGHASH_SINGLE",
        "index": 0,
      }
    }, null, 2);

    setBody(template);
  };

  const handleCreateInitialTransaction = () => {
    if (!distributorTx) return;

    const tx = new Transaction();
    tx.addInput({
      sourceTransaction: distributorTx,
      sourceOutputIndex: distributorTxInputIndex,
      unlockingScriptTemplate: new P2PKH().unlock(PrivateKey.fromRandom(), 'none'),
      sequence: 0xFFFFFFFF,
    });

    tx.addOutput({
      lockingScript: new P2PKH().lock(PrivateKey.fromRandom().toPublicKey().toAddress()),
      satoshis: 100000000, // Example amount
    });

    setBuyerTx(tx);
    setOutputText(JSON.stringify(JSON.stringify(tx), null, 2));
  };

  const handleBuyerBuildAndSign = async () => {
    if (!buyerTx) return;

    const tx = buyerTx;


    setTitle("Step 2: Buyer adds ticket inputs and outputs");



    tx.addInput({
      sourceTransaction: distributorTx,
      sourceOutputIndex: distributorTxInputIndex,
      unlockingScriptTemplate: new P2PKH().unlock(PrivateKey.fromWif('L259sfQyASg5rpjxMHCh1XbaoRYAvkNCzrMSRG3kuVp2bA9YveX8'), 'none', true),
      sequence: 0xFFFFFFFF,
    });

    tx.addOutput({
      lockingScript: new P2PKH().lock(distributorOutputKey.toAddress()),
      satoshis: 100000000,
    });

    tx.addOutput({
      lockingScript: new P2PKH().lock(PrivateKey.fromWif('L259sfQyASg5rpjxMHCh1XbaoRYAvkNCzrMSRG3kuVp2bA9YveX8').toAddress()),
      change: true,
    });

    try {
      await tx.fee(new SatoshisPerKilobyte(1));
      await tx.sign();
    } catch (error) {
      console.error(error);
      return;
    }
    console.log(JSON.stringify({"rawTx": tx.toHex()}));

    setBuyerTx(tx);
    setBody(JSON.stringify(tx));


  };

  const handleDistributorBuildAndSign = async () => {
    if (!buyerTx) return;
    const tx = buyerTx;

    setTitle("Step 3: Distributor adds ticket inputs and outputs");

    selectedTickets.forEach((index) => {
      tx.addInput({
        sourceTransaction: distributorTx,
        sourceOutputIndex: index,
        unlockingScriptTemplate: new P2PKH().unlock(distributorKeys[index], 'none', true),
        sequence: 0xFFFFFFFF,
      });

      const key: PrivateKey = PrivateKey.fromString((Hash.sha256hmac(hmacKey, PrivateKey.fromRandom().toPublicKey().toHash()+(buyerHashedTickets[index % buyerHashedTickets.length].hash.join(''), 'hex'))).join(''), 'hex');
      buyerKeys.push(key);
      tx.addOutput({
        lockingScript: new P2PKH().lock(key.toAddress()),
        satoshis: 10000,
      })
    });

  const handleSpvVerification =  async () => {
    if (!!hmacKey || !distributorTx || !distributorTxMerklePath) return;

    const tx = distributorTx;
    const merklePath = distributorTxMerklePath;

    tx.merklePath = MerklePath.fromHex(merklePath);
    const result = await tx.verify();

    setOutputText(result.toString());
    console.log(result);
  }

  const handleGetMerklePath = async () => {
    const merklePath = await getMerklePath(distributorTx);
    setBuyerTxMerklePath(merklePath);
    setOutputText(JSON.stringify(merklePath, null, 2));
    onGetMerklePath(merklePath);
  };

    tx.addOutput({
      lockingScript: new P2PKH().lock(PrivateKey.fromWif('L259sfQyASg5rpjxMHCh1XbaoRYAvkNCzrMSRG3kuVp2bA9YveX8').toAddress()),
      change: true,
    });

    try {
      await tx.fee(new SatoshisPerKilobyte(1));
      await tx.sign();
    } catch (error) {
      console.error(error);
      return;
    }
    console.log(JSON.stringify({"rawTx": tx.toHex()}));

    setBuyerTx(tx);
    setBuyerTxOutputIndex(tx.outputs.length - buyerHashedTickets.length - 1);
    setBody(JSON.stringify(tx));
  };

  const handleSelectBuyerTickets = () => {
    if (!distributorTx) return;

    const bTickets: Ticket[] = [];

    selectedTickets.forEach(index => {
      bTickets.push(distributorTickets[index]);
    });
    setBuyerTickets(bTickets);
    onSelectBuyerTickets(bTickets, selectedTickets);

  };

  const handleHashBuyerTickets = () => {
    const buyerHashedTickets = buyerTickets.map(ticket => ({
      ticket,
      hash: Array.from(Hash.sha256hmac(hmacKey, JSON.stringify(ticket)))
    }));
    setBuyerHashedTickets(buyerHashedTickets);

  };

  const clearBuyerTransaction = () => {
    setBuyerTx(new Transaction());
  };

  const handleSubmitTransaction = async () => {
    await handleSubmitTx(buyerTx as Transaction);
    onBuy(buyerTx as Transaction, buyerTxOutputIndex, buyerKeys, buyer2Keys);
  };

  const handleSellTicket = async () => {
    const tx = buyerTx as Transaction;
    const b2Keys: PrivateKey[] = [];
    selectedTickets.forEach((index) => {
      const hashedTicket = buyerHashedTickets[index]
    

      const key: PrivateKey = PrivateKey.fromString((Hash.sha256hmac(hmacKey, PrivateKey.fromRandom().toPublicKey().toHash()+(hashedTicket.hash.join(''), 'hex'))).join(''), 'hex');
      b2Keys.push(key);
      tx.outputs[index+buyerHashedTickets.length] = ({
        lockingScript: new P2PKH().lock(key.toAddress()),
        satoshis: 1000,
      });

      setBuyer2Keys(b2Keys);
      setBuyerTx(tx);
      setBody(JSON.stringify(tx));
      console.log(JSON.stringify({"rawTx": tx.toHex()}));
    });

  }

  const handleSignTransaction = async () => {
    if (!buyerTx) return;

    await buyerTx.sign();
    setOutputText(JSON.stringify(JSON.stringify(buyerTx), null, 2));
  };

  const handleSendToDistributor = () => {
    if (!buyerTx) return;

    //const buyerPublicKeys = selectedTickets.map(() => PrivateKey.fromRandom().toPublicKey());
    onBuy(buyerTx, buyerTxOutputIndex, buyerKeys, buyer2Keys);
    setOutputText("Transaction sent to Distributor with buyer public keys");
  };

  const handleResellTickets = () => {
    if (!buyerTx) return;

    const resoldTx = buyerTx
    selectedTickets.forEach((index) => {
      const newKey = PrivateKey.fromRandom().toPublicKey();
      resoldTx.outputs[index].lockingScript = new P2PKH().lock(newKey.toAddress());
    });

    setBuyerTx(resoldTx);
    setOutputText(JSON.stringify(JSON.stringify(resoldTx), null, 2));
  };

  const handleRequestEventGateKeys = async () => {
    // Simulating request to EventGate for public keys
    const eventGateKeys: PrivateKey[] = [];
    for (let i = 0; i < selectedTickets.size; i++) {
      eventGateKeys[i] = PrivateKey.fromRandom();
    }
    
    if (!buyerTx) return;

    const updatedTx = buyerTx;
    selectedTickets.forEach((index, i) => {
      updatedTx.outputs[index].lockingScript = new P2PKH().lock(eventGateKeys[i].toAddress());
    });

    setBuyerTx(updatedTx);
    setOutputText(JSON.stringify(JSON.stringify(updatedTx), null, 2));
  };

  const handleSendToEventGate = async () => {
    if (!buyerTx) return;

    const merklePath = await getMerklePath(buyerTx);
    // Here you would typically send the transaction and merkle path to the EventGate
    setOutputText(`Transaction and Merkle path ready to send to EventGate: ${merklePath}`);
  };

  return (
    <div>
    <Typography variant="h4" gutterBottom>
      Buyer
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
          {distributorTickets.map((ticket, idx) => (
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
      <Button variant="contained" onClick={handleSelectBuyerTickets} 
      style={{ marginTop: '16px' }}>
        Select Tickets to buy
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
            {distributorHashedTickets.map((hashedTicket, idx) => (
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
            {buyerHashedTickets.map((hashedTicket, idx) => (
              <TableRow key={idx}>
                <TableCell>{Object.values(hashedTicket.ticket).toString()}</TableCell>
                <TableCell>{toHexString(hashedTicket.hash)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <div>
        <Button variant="contained" onClick={handleHashBuyerTickets} 
        style={{ marginTop: '16px' }}>
          Hash Selected Tickets
        </Button>
      </div>
    </Grid>
    </Grid>
      <div>
        <Button variant="contained" onClick={handleCreateInitialTransaction} style={{ marginTop: '16px' }}>
          Create Initial Transaction
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleSignTransaction} style={{ marginTop: '16px' }}>
          Sign Transaction
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleSendToDistributor} style={{ marginTop: '16px' }}>
          Send to Distributor
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleSubmitTransaction} style={{ marginTop: '16px' }}>
          Submit Transaction
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleResellTickets} style={{ marginTop: '16px' }}>
          Resell Tickets
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleRequestEventGateKeys} style={{ marginTop: '16px' }}>
          Request EventGate Keys
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleSendToEventGate} style={{ marginTop: '16px' }}>
          Send to EventGate
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={clearBuyerTransaction} 
        style={{ marginTop: '16px' }}>
          Clear Transaction
        </Button>
      </div>
      <div>
      {(
        <div style={{ marginTop: '16px' }}>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <JSONPretty id="json-pretty" className="json-pretty-container" data={body}></JSONPretty>
        </div>
      )}
    </div>
    </div>
  );
};

export default Buyer;
