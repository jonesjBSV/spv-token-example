import React, { useState } from 'react';
import { AppBar, Tabs, Tab, Box } from '@mui/material';
import TicketCreator, { Ticket, HashedTicket } from './TicketCreator';
import Distributor from './Distributor';
import Buyer from './Buyer';
import EventGate from './EventGate';
import { PrivateKey, Transaction } from '@bsv/sdk';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box p={3}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const AppTabs: React.FC = () => {
  const [value, setValue] = useState(0);
  const [creatorKey] = useState<PrivateKey>(new PrivateKey());
  const [creatorKeys, setCreatorKeys] = useState<PrivateKey[]>([]);
  const [hmKey, setHmKey] = useState<string>(PrivateKey.fromRandom().toString());
  const [distributorTx, setDistributorTx] = useState<Transaction>(new Transaction());
  const [distributorTxInputIndex, setDistributorTxInputIndex] = useState<number>(0);
  const [buyerTx, setBuyerTx] = useState<Transaction>(new Transaction());
  const [createdTx, setCreatedTx] = useState<Transaction>(new Transaction());
  const [createdTickets, setCreatedTickets] = useState<Ticket[]>([]);
  const [createdHashedTickets, setcreatedHashedTickets] = useState<HashedTicket[]>([]);
  const [distributorTickets, setDistributorTickets] = useState<Ticket[]>([]);
  const [distributorHashedTickets, setDistributorHashedTickets] = useState<HashedTicket[]>([]);
  const [distributorKeys, setDistributorKeys] = useState<PrivateKey[]>([]);
  const [privKey, setPrivKey] = useState<PrivateKey>(new PrivateKey())
  const [creatorTxMerklePath, setCreatorTxMerklePath] = useState<string>("");
  const [prevTxOutputIndex, setPrevTxOutputIndex] = useState<number>(0);
  const [buyerTickets, setBuyerTickets] = useState<Ticket[]>([]);
  const [buyerKeys, setBuyerKeys] = useState<PrivateKey[]>([]);
  const [buyer2Keys, setBuyer2Keys] = useState<PrivateKey[]>([]);
  const [buyerTxOutputIndex, setBuyerTxOutputIndex] = useState<number>(0);
  const [buyerIndexes, setBuyerIndexes] = useState<Set<number>>(new Set());

  const handleChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setValue(newValue);
  };

  return (
    <div>
      <AppBar position="static">
        <Tabs className="Tabs-header" value={value} onChange={handleChange} aria-label="simple tabs example">
          <Tab label="Ticket Creator" {...a11yProps(0)} />
          <Tab label="Distributor" {...a11yProps(1)} />
          <Tab label="Buyer" {...a11yProps(2)} />
          <Tab label="Event Gate" {...a11yProps(3)} />
        </Tabs>
      </AppBar>
      <TabPanel value={value} index={0}>
        <TicketCreator
          ticks={createdTickets}
          hashedTicks={createdHashedTickets}
          createdTx={createdTx}
          onGetMerklePath={(merklePath) => setCreatorTxMerklePath(merklePath)}
          onTransactionSigned={(privateKey, hmacKey) => {setPrivKey(privateKey); setHmKey(hmacKey)}}
          onTransactionCreated={(tx, creatorKeys, txOutputIndex) => {setCreatedTx(tx); setCreatorKeys(creatorKeys); setPrevTxOutputIndex(txOutputIndex)}}
          onTicketsCreated={(tickets) => setCreatedTickets(tickets)}
          onTicketsHashed={(hashedTickets) => setcreatedHashedTickets(hashedTickets)}
        />
      </TabPanel>
      <TabPanel value={value} index={1}>
        <Distributor
          distTicks={distributorTickets}
          distHashedTicks={distributorHashedTickets}
          hashedTickets={createdHashedTickets}
          creatorKey={creatorKey}
          creatorKeys={creatorKeys}
          hmacKey={hmKey}
          creatorTx={createdTx}
          creatorTxMerklePath={creatorTxMerklePath}
          prevTxOutputIndex={prevTxOutputIndex}
          tickets={createdTickets}
          onDistribute={(tx, index, distributorKeys) => {setDistributorTx(tx); setDistributorTxInputIndex(index); setDistributorKeys(distributorKeys)}}
          onSelectDistributedTickets={(ticks) => setDistributorTickets(ticks)}
          onHashDistributedTickets={(hashedTicks) => setDistributorHashedTickets(hashedTicks)}
        />
      </TabPanel>
      <TabPanel value={value} index={2}>
        <Buyer
          distributorTxInputIndex={distributorTxInputIndex}
          distributorTx={distributorTx}
          distributorKeys={distributorKeys}
          distributorTickets={distributorTickets}
          distributorHashedTickets={distributorHashedTickets}
          hmacKey={hmKey}
          buyerPublicKey={new PrivateKey().toPublicKey()}
          onBuy={(tx, buyerTxOutputIndex, buyerKeys, buyer2Keys) => {setBuyerTx(tx); setBuyerTxOutputIndex(buyerTxOutputIndex); setBuyerKeys(buyerKeys); setBuyer2Keys(buyer2Keys)}}
          onSelectBuyerTickets={(ticks, indexes) => {setBuyerTickets(ticks); setBuyerIndexes(indexes)}}
        />
      </TabPanel>
      <TabPanel value={value} index={3}>
        <EventGate
          hmacKey={hmKey}
          buyerIndexes={buyerIndexes}
          buyerTickets={buyerTickets}
          hashedTickets={createdHashedTickets}
          buyerTx={buyerTx}
          buyerTxOutputIndex={buyerTxOutputIndex}
          buyerKey={creatorKey}
          buyerKeys={buyerKeys}
          onEventGateEntry={(tx, privateKey, publicKey) => {}}
        />
      </TabPanel>
    </div>
  );
};

export default AppTabs;
