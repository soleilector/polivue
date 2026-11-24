import React from 'react';
import { Fragment, useState, useEffect } from 'react';
import {
  LinkedButton,
  LoadingIcon,
  PageContainer,
  StatusTag,
  themeClrs,
} from './Architecture.jsx';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import axios from 'axios';

//== Chart colors (checked for color-blind separation; every slice also carries its name and count)
const sourceColors = { // PoliVue's theme colors
  'User-uploaded': '#0f6e6b', // teal, like the buttons
  'Hadi-created': '#5cc7d1', // Hadi's icon color
};
const statusColors = { // halfway between the pale status tag colors and a full color
  'resolved': '#76ae86', // green
  'unresolved': '#ee9794', // red
  'remediating': '#f4c07c', // orange
};
const statusOrder = ['resolved', 'unresolved', 'remediating'];

// The views of the status box: which documents each one counts
const statusViews = {
  'all': { label: 'All documents', keep: () => true },
  'user': { label: 'User-uploaded documents', keep: (thisDocument) => !isHadiDocument(thisDocument) },
  'hadi': { label: 'Hadi-created documents', keep: (thisDocument) => isHadiDocument(thisDocument) },
};

// Documents that Hadi created are saved with a 'hadi-' prefix
function isHadiDocument(thisDocument) {
  return thisDocument.Key.toLowerCase().startsWith('hadi-');
}

//== Display
const LABEL_INK = '#1f2a2e'; // text stays dark; the colored slice beside it shows which one it is

// Writes the slice's name and count beside it, so a slice is never told apart by color alone
function sliceLabel({ name, value, percent, x, y, textAnchor }) {
  if (value <= 0) { return null; }
  return (
    <text x={x} y={y} fill={LABEL_INK} textAnchor={textAnchor} dominantBaseline='central' fontSize={13}>
      {`${name}: ${value} (${Math.round(percent * 100)}%)`}
    </text>
  );
}

function DocumentPie({ data, colors }) {
  const shownData = data.filter((slice) => slice.value > 0); // empty slices are left out of the circle
  
  if (shownData.length === 0) {
    return (<p className='dashboardEmpty'>No documents yet.</p>);
  }
  
  return (
    <ResponsiveContainer width='100%' height={260}>
      <PieChart>
        <Pie
          data={shownData}
          dataKey='value'
          nameKey='name'
          outerRadius={85}
          stroke='#ffffff'
          strokeWidth={2}
          label={sliceLabel}
          labelLine={false}
          isAnimationActive={false}
        >
          {shownData.map((slice) => (
            <Cell key={slice.name} fill={colors[slice.name]} />
          ))}
        </Pie>
        <Tooltip formatter={(value, name) => [`${value} document(s)`, name]} />
        <Legend itemSorter={null} formatter={(name) => (<span style={{ color: LABEL_INK }}>{name}</span>)} />
      </PieChart>
    </ResponsiveContainer>
  )
}

//-- How many documents are in the bucket
function DocumentCount({ documents }) {
  return (
    <div className='dashboardBox' id='documentCountBox'>
      <h3>Documents uploaded</h3>
      <p className='dashboardBigNumber'>{documents.length}</p>
      <p className='dashboardNote'>PDF, markdown, and text files in the bucket</p>
    </div>
  )
}

//-- User-uploaded documents compared with Hadi-created documents
function DocumentSources({ documents }) {
  const hadiCount = documents.filter(isHadiDocument).length;
  
  return (
    <div className='dashboardBox' id='documentSourceBox'>
      <h3>Who created them</h3>
      <DocumentPie
        data={[
          { name: 'User-uploaded', value: documents.length - hadiCount },
          { name: 'Hadi-created', value: hadiCount },
        ]}
        colors={sourceColors}
      />
    </div>
  )
}

//-- Resolved, unresolved, and remediating, for the documents of the chosen view
function DocumentStatuses({ documents }) {
  const [ viewNm, setViewNm ] = useState('all');
  
  const viewDocuments = documents.filter(statusViews[viewNm].keep);
  const statusCounts = statusOrder.map((thisStatus) => ({
    name: thisStatus,
    value: viewDocuments.filter((thisDocument) => thisDocument.Status === thisStatus).length,
  }));
  const unreadCount = viewDocuments.filter((thisDocument) => !statusOrder.includes(thisDocument.Status)).length; // statuses that could not be read
  
  return (
    <div className='dashboardBox dashboardWide' id='documentStatusBox'>
      <div className='dashboardBoxHeading'>
        <h3>Document status: {statusViews[viewNm].label}</h3>
        <select id='statusViewSelect' value={viewNm} onChange={(e) => setViewNm(e.target.value)}>
          {Object.entries(statusViews).map(([thisViewNm, thisView]) => (
            <option key={thisViewNm} value={thisViewNm}>{thisView.label}</option>
          ))}
        </select>
      </div>
      <div className='dashboardStatusBody'>
        <ul className='dashboardStatusNumbers'>
          {statusCounts.map((thisCount) => (
            <li key={thisCount.name} id={'statusCount-' + thisCount.name}>
              <span className='dashboardStatusNumber'>{thisCount.value}</span> <StatusTag status={thisCount.name} />
            </li>
          ))}
          {unreadCount > 0 ? (<li className='dashboardNote'>{unreadCount} document(s) with a status that could not be read</li>) : null}
        </ul>
        <div className='dashboardStatusChart'>
          <DocumentPie data={statusCounts} colors={statusColors} />
        </div>
      </div>
    </div>
  )
}

function Page(){
  const [ documents, setDocuments ] = useState(null); // null until the list has loaded
  const [ loadFailed, setLoadFailed ] = useState(false);
  
  //-- Retrieve the documents and their statuses (the list never includes config.json)
  useEffect(() => {
    const api_url = '/get-documents';
    
    const loadDocuments = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(); // this will cancel the request
      }, 30000);
      
      try {
        const response = await axios.post(api_url, {}, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        setDocuments(response.data.Contents || []);
      } catch (error) { // Retrieval failed.
        clearTimeout(timeoutId);
        console.log('Could not load the documents for the dashboard: ' + error.message);
        setLoadFailed(true);
      }
    };
    
    loadDocuments();
  }, []);
  
  return (
    <Fragment>
      <h1>Dashboard</h1>
      <br/>
      {loadFailed ? (<p>We could not load the documents. Please reload the page.</p>) : null}
      {!loadFailed && documents === null ? (<LoadingIcon size={100} color={themeClrs.icon} />) : null}
      {documents !== null ? (
        <Fragment>
          <div className='dashboardRow'>
            <DocumentSources documents={documents} />
            <DocumentCount documents={documents} />
          </div>
          <div className='dashboardRow'>
            <DocumentStatuses documents={documents} />
          </div>
        </Fragment>
      ) : null}
      <br/>
      <LinkedButton
        label='Manage Policies'
        link={'/policy'}
        />
    </Fragment>
  )
}

function Dashboard() {
  return (
    <Fragment>
      <PageContainer
        content={<Page />}
      />
    </Fragment>
  )
}

export default Dashboard;
