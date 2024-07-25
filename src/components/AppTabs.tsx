import React, { useState } from 'react';
import { AppBar, Tabs, Tab, Box } from '@mui/material';
import TicketCreator, { Ticket, HashedTicket, Tranche } from './Creator';
import Distributor from './Distributor';
import Buyer from './Buyer';
import EventGate from './EventGate';
import { PrivateKey, PublicKey, Transaction } from '@bsv/sdk';

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
  const [creatorTx, setCreatorTx] = useState<Transaction>(new Transaction());
  const [createdTickets, setCreatedTickets] = useState<Ticket[]>([]);
  const [createdHashedTickets, setcreatedHashedTickets] = useState<HashedTicket[]>([]);
  const [distributorTickets, setDistributorTickets] = useState<Ticket[]>([]);
  const [distributorHashedTickets, setDistributorHashedTickets] = useState<HashedTicket[]>([]);
  const [distributorKeys, setDistributorKeys] = useState<PrivateKey[]>([]);
  const [numDistributorKeys, setNumDistributorKeys] = useState<number>(0);
  const [privKey, setPrivKey] = useState<PrivateKey>(new PrivateKey())
  const [creatorTxMerklePath, setCreatorTxMerklePath] = useState<string>('');
  const [prevTxOutputIndex, setCreatorTxOutputIndex] = useState<number>(0);
  const [buyerTickets, setBuyerTickets] = useState<Ticket[]>([]);
  const [buyerKeys, setBuyerKeys] = useState<PrivateKey[]>([]);
  const [buyer2Keys, setBuyer2Keys] = useState<PrivateKey[]>([]);
  const [buyerTxOutputIndex, setBuyerTxOutputIndex] = useState<number>(0);
  const [buyerIndexes, setBuyerIndexes] = useState<Set<number>>(new Set());
  const [distributorTxMerklePath, setDistributorTxMerklePath] = useState<string>("");
  const [distributorPrivKeys, setDistributorPrivKeys] = useState<PrivateKey[]>([]);
  const [distributorPubKeys, setDistributorPubKeys] = useState<PublicKey[]>([]);
  const [buyerTxMerklePath, setBuyerTxMerklePath] = useState<string>("");
  const [redeemedTxMerklePath, setRedeemedTxMerklePath] = useState<string>("");
  const [creatorTranches, setCreatorTranches] = useState<Tranche[]>([]);

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
          creatorTranches ={creatorTranches}
          distPubKeys ={distributorPubKeys}
          onGetMerklePath={(merklePath) => setCreatorTxMerklePath(merklePath)}
          onTransactionSigned={(privateKey, hmacKey) => {setPrivKey(privateKey); setHmKey(hmacKey)}}
          onDistributorTxCreated={(tx) => setCreatorTx(tx)}
          onTicketsCreated={(tickets) => setCreatedTickets(tickets)}
          onTicketsHashed={(hashedTickets) => setcreatedHashedTickets(hashedTickets)}
          onTrancheCreated={(tranches) => setCreatorTranches(tranches)}
          onRequestDistributorPubKeys={(numKeys) => setNumDistributorKeys(numKeys)}
        />
      </TabPanel>
      <TabPanel value={value} index={1}>
        <Distributor
          distHashedTicks={distributorHashedTickets}
          hashedTickets={createdHashedTickets}
          creatorKey={creatorKey}
          creatorKeys={creatorKeys}
          hmacKey={hmKey}
          cTx={creatorTx}
          creatorTxMerklePath={creatorTxMerklePath}
          creatorTxOutputIndex={prevTxOutputIndex}
          tickets={createdTickets}
          numDistributorKeys={numDistributorKeys}
          distPrivKeys={distributorPrivKeys}
          distPubKeys={distributorPubKeys}
          onDistribute={(tx, index, distributorKeys) => {setDistributorTx(tx); setDistributorTxInputIndex(index); setDistributorKeys(distributorKeys)}}
          onSelectDistributedTickets={(ticks) => setDistributorTickets(ticks)}
          onHashDistributedTickets={(hashedTicks) => setDistributorHashedTickets(hashedTicks)}
          onGetMerklePath={(merklePath) => setDistributorTxMerklePath(merklePath)}
          onCreateDistributorKeys={(distPrivKeys, distPubKeys) => {setDistributorPrivKeys(distPrivKeys); setDistributorPubKeys(distPubKeys)}}
        />
      </TabPanel>
      <TabPanel value={value} index={2}>
        <Buyer
          distributorTxInputIndex={distributorTxInputIndex}
          distributorTxMerklePath={distributorTxMerklePath}
          distributorTx={distributorTx}
          distributorKeys={distributorKeys}
          distributorTickets={distributorTickets}
          distributorHashedTickets={distributorHashedTickets}
          hmacKey={hmKey}
          buyerPublicKey={new PrivateKey().toPublicKey()}
          onBuy={(tx, buyerTxOutputIndex, buyerKeys, buyer2Keys) => {setBuyerTx(tx); setBuyerTxOutputIndex(buyerTxOutputIndex); setBuyerKeys(buyerKeys); setBuyer2Keys(buyer2Keys)}}
          onSelectBuyerTickets={(ticks, indexes) => {setBuyerTickets(ticks); setBuyerIndexes(indexes)}}
          onGetMerklePath={(merklePath) => setBuyerTxMerklePath(merklePath)}
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
          buyerTxMerklePath={buyerTxMerklePath}
          onEventGateEntry={(tx, privateKey, publicKey) => {}}
          onGetMerklePath={(merklePath) => setRedeemedTxMerklePath(merklePath)}
        />
      </TabPanel>
    </div>
  );
};

export default AppTabs;
