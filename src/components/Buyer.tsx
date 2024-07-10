import React, { useState } from 'react';
import { Hash, Transaction, PrivateKey, PublicKey, P2PKH, SatoshisPerKilobyte, TransactionOutput } from '@bsv/sdk';
import { TextField, Button, Typography, List, ListItem, ListItemText, Grid, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Checkbox } from '@mui/material';
import { HashedTicket, Ticket } from './TicketCreator';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';

interface Props {
  distributorTx: Transaction;
  distributorKeys: PrivateKey[];
  distributorTickets: Ticket[];
  distributorHashedTickets: HashedTicket[];
  distributorTxInputIndex: number;
  buyerPublicKey: PublicKey | null;
  hmacKey: string;
  onBuy: (tx: Transaction, buyerTxOutputIndex: number, buyerKeys: PrivateKey[], buyer2Keys: PrivateKey[]) => void;
  onSelectBuyerTickets: (buyerTickets: Ticket[]) => void;
}

const Buyer: React.FC<Props> = ({ distributorTxInputIndex, distributorTx, distributorKeys, distributorTickets, distributorHashedTickets, buyerPublicKey, hmacKey, onBuy }) => {
  const [buyerTickets, setBuyerTickets] = useState<Ticket[]>([]);
  const [buyerHashedTickets, setBuyerHashedTickets] = useState<HashedTicket[]>([]);
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [selectedTickets, setSelectedTickets] = useState<Set<number>>(new Set());
  const [transactionTemplate, setTransactionTemplate] = useState<Transaction | null>(null);
  const [distributorOutputKey, setDistributorOutputKey] = useState<PrivateKey>(PrivateKey.fromRandom());
  const [buyerTx, setBuyerTx] = useState<Transaction>(new Transaction());
  const [buyerKeys, setBuyerKeys] = useState<PrivateKey[]>([]);
  const [buyer2Keys, setBuyer2Keys] = useState<PrivateKey[]>([]);
  const [buyerTxOutputIndex, setBuyerTxOutputIndex] = useState<number>(0);

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
      await tx.fee(new SatoshisPerKilobyte(10));
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

    buyerHashedTickets.forEach((hashedTicket, index) => {
      tx.addInput({
        sourceTransaction: distributorTx,
        sourceOutputIndex: index,
        unlockingScriptTemplate: new P2PKH().unlock(distributorKeys[index], 'none', true),
        sequence: 0xFFFFFFFF,
      });

      const key: PrivateKey = PrivateKey.fromString((Hash.sha256hmac(hmacKey, PrivateKey.fromRandom().toPublicKey().toHash()+(hashedTicket.hash.join(''), 'hex'))).join(''), 'hex');
      buyerKeys.push(key);
      tx.addOutput({
        lockingScript: new P2PKH().lock(key.toAddress()),
        satoshis: 10000,
      })
    });

    tx.addOutput({
      lockingScript: new P2PKH().lock(distributorOutputKey.toAddress()),
      change: true,
    });

    try {
      await tx.fee(new SatoshisPerKilobyte(10));
      await tx.sign();
    } catch (error) {
      console.error(error);
      return;
    }
    console.log(JSON.stringify({"rawTx": tx.toHex()}));

    setBuyerTx(tx);
    setBuyerTxOutputIndex(tx.outputs.length - 3);
    setBody(JSON.stringify(tx));
  };

  const handleSelectBuyerTickets = () => {
    if (!distributorTx) return;

    const bTickets: Ticket[] = [];

    selectedTickets.forEach(index => {
      bTickets.push(distributorTickets[index]);
    });
    setBuyerTickets(bTickets);

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
    const tx = buyerTx;

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

    onBuy(tx, buyerTxOutputIndex, buyerKeys, buyer2Keys);
  };

  const handleSellTicket = async () => {
    const tx = buyerTx;
    const b2Keys: PrivateKey[] = [];
    selectedTickets.forEach((index) => {
      const ticket = buyerHashedTickets[index]
    

      const key = PrivateKey.fromString((Hash.sha256hmac(hmacKey, PrivateKey.fromRandom().toPublicKey().toHash()+(ticket).hash.join(''), 'hex')).join(''), 'hex');
      tx.outputs[tx.outputs.length - 1] = {
        lockingScript: new P2PKH().lock(distributorOutputKey.toAddress()),
        satoshis: 1000,
      };

      b2Keys.push(key);
      tx.outputs[index+buyerHashedTickets.length] = ({
        lockingScript: new P2PKH().lock(key.toAddress()),
        satoshis: 1000,
      });

      setBuyer2Keys(b2Keys);

    });

  }

  const toHexString = (byteArray: number[]) => {
    return byteArray.map(byte => byte.toString(16).padStart(2, '0')).join(' ');
  };

  const hasInputsOrOutputs = (tx: Transaction | null) => {
    return tx && (tx.inputs.length > 0 || tx.outputs.length > 0);
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
      <div>
        <Button variant="contained" onClick={handleHashBuyerTickets} 
        style={{ marginTop: '16px' }}>
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
        <Button variant="contained" onClick={clearBuyerTransaction} 
        style={{ marginTop: '16px' }}>
          Clear Transaction
        </Button>
      </div>
    </Grid>
    </Grid>
      <div>
        <Button variant="contained" onClick={handleRequestTemplate} style={{ marginTop: '16px' }}>
          Step 1
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleBuyerBuildAndSign} style={{ marginTop: '16px' }}>
          Step 2
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleDistributorBuildAndSign} style={{ marginTop: '16px' }}>
          Step 3
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleSubmitTransaction} style={{ marginTop: '16px' }}>
          Submit Transaction
        </Button>
      </div>
      <div>
        <Button variant="contained" onClick={handleSellTicket} style={{ marginTop: '16px' }}>
          Sell Ticket
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
