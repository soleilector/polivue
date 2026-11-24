import React, {useEffect, useRef} from 'react';
import { Fragment, useState } from 'react';
import { Button, LinkedButton, PageContainer, PopUp, togglePopUp} from './Architecture.jsx';
import DataTable from "react-data-table-component";
import axios from 'axios';

const connectionTemplate = { // what a new GIT-REPO-PUBLIC connection looks like
  authToken: '',
  username: '',
  repoNm: '',
  branch: 'main',
  subdirectory: '',
  description: '', // required, up to 100 words about what the repository holds
};

const saveMessages = {
  'busy' : {
    color: 'green',
    text: 'Saving... '
  },
  'saved' : {
    color: 'green',
    text: 'Saved!'
  },
};

function Table({ connectList, onViewClick }){
  const columns = [
    {name: 'Connection Name', selector: row => row.name, sortable: true},
    {name: 'Type', selector: row => row.type, sortable: true},
    {name: 'Options', cell: (clickedRow) => (
        <>
          <Button
            label='View'
            onClick={(e) => {
              onViewClick(clickedRow);
            }}
          />
        </>
      ), ignoreRowClick: true, // each row has onRowClicked={(row,event)=>{...}}
      allowOverflow: true}
  ];

  return (
    <Fragment>
      <div id='datatable' className='datatable'>
        <DataTable
          columns={columns}
          data={connectList}
          onRowClicked={(clickedRow, event) => { onViewClick(clickedRow); }}
          highlightOnHover
          pointerOnHover
        />
      </div>
    </Fragment>
  );
}

function Page(){
  const [ connections, setConnectionsList ] = useState([]);
  const [ configLoaded, setConfigLoaded ] = useState(false); // true once we know what is stored
  const [ configExists, setConfigExists ] = useState(true); // false when there is no config.json in the bucket yet
  const [ loadFailed, setLoadFailed ] = useState(false);
  const [ connectorTypes, setConnectorTypes ] = useState({}); // the kinds of connectors that can be created
  const [ selectedType, setSelectedType ] = useState(''); // the kind picked in the drop down list
  const lastCreateClick = useRef(0); // when the create button was last used, to ignore rapid clicks
  
  //== The connection that is open in the box
  const [ editName, setEditName ] = useState('');
  const [ editType, setEditType ] = useState('GIT-REPO-PUBLIC');
  const [ editText, setEditText ] = useState(''); // the configuration, as text that the user can change
  const [ isNewConnection, setIsNewConnection ] = useState(false);
  const [ saveState, setSaveState ] = useState('none'); // 'none', 'busy', 'saved', 'failed'
  const [ saveError, setSaveError ] = useState('');
  
  // Turn the stored configuration text into the rows of our table
  const showConnectionsFromConfig = (configStr) => {
    const connectList = [];
    
    for (const [thisConnectNm,thisConnectConfig] of Object.entries(JSON.parse(configStr))) {
      connectList.push({
        name: thisConnectNm,
        type: thisConnectConfig.type,
        config: JSON.stringify(thisConnectConfig.config),
      })
    }
    
    setConnectionsList(connectList);
  }
  
  // Retrieve the saved connections
  useEffect(() => {
    const loadConnections = async () => {
      const api_url = '/get-connectable-info';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(); // this will cancel the request
      }, 10000);
      
      try {
        const response = await axios.post(api_url, {
          connectableName: 'ALL',
        }, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        setConfigExists(response.data.exists !== false); // false when no connection has been saved yet
        showConnectionsFromConfig(response.data.config);
        setConnectorTypes(response.data.connectorTypes || {});
        setSelectedType((oldValue) => oldValue || Object.keys(response.data.connectorTypes || {})[0] || 'GIT-REPO-PUBLIC'); // keep the choice the user made
        setConfigLoaded(true);
      } catch (error) { // Connection failed.
        clearTimeout(timeoutId);
        console.log('Could not load the connections: ' + error.message);
        setLoadFailed(true);
      }
    };
    
    loadConnections();
  },[]);
  
  //== Open the box to change a connection that already exists
  const onViewConfigInfo = (clickedRow) => {
    setIsNewConnection(false);
    setEditName(clickedRow.name);
    setEditType(clickedRow.type);
    setEditText(JSON.stringify(JSON.parse(clickedRow.config), null, 2)); // easier to read than one line
    setSaveState('none');
    togglePopUp(true);
  }
  
  //== Has this kind of connector reached how many are allowed? (limit is null when unlimited)
  const isTypeFull = (typeNm) => {
    const limit = connectorTypes[typeNm] ? connectorTypes[typeNm].limit : null;
    return limit !== null && limit !== undefined && connections.filter((thisConnection) => thisConnection.type === typeNm).length >= limit;
  }
  
  //== Open the box to create a connection of the kind picked in the drop down list (the first one also creates config.json)
  const onCreateConnection = () => {
    // Some kinds of connectors can only exist a set number of times
    if (isTypeFull(selectedType)) { return; }

    // Debounce: rapid clicks are ignored, so that the box does not keep re-appearing
    const now = Date.now();
    if (now - lastCreateClick.current < 600) { return; }
    lastCreateClick.current = now;
    
    // The box is already open, so do not reset what is being typed into it
    const popUp = document.getElementById('popup');
    if (popUp && popUp.classList.contains('show')) { return; }
    
    const thisTemplate = connectorTypes[selectedType] ? connectorTypes[selectedType].template : connectionTemplate;
    
    setIsNewConnection(true);
    setEditName('');
    setEditType(selectedType || 'GIT-REPO-PUBLIC');
    setEditText(JSON.stringify(thisTemplate, null, 2));
    setSaveState('none');
    togglePopUp(true);
  }
  
  //== Save the changes made in the box
  const onSaveClick = async () => {
    if (saveState === 'busy') { return; } // we are already saving
    
    let connectInfo;
    try {
      connectInfo = JSON.parse(editText);
    } catch (error) {
      setSaveError('The configuration is not valid JSON.');
      setSaveState('failed');
      return;
    }
    
    // Every setting that must have a value (not null, and not "") has to be filled before we save
    const thisConnectorType = connectorTypes[editType];
    const missingSettings = (thisConnectorType ? thisConnectorType.required : []).filter((settingNm) => {
      return typeof connectInfo[settingNm] !== 'string' || connectInfo[settingNm].trim() === '';
    });
    if (missingSettings.length > 0) {
      setSaveError(`Please fill the ${missingSettings.map((settingNm) => thisConnectorType.labels[settingNm] || settingNm).join(', ')} field(s) to save`);
      setSaveState('failed');
      return;
    }
    
    setSaveState('busy');
    
    const api_url = '/update-connectible';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(); // this will cancel the request
    }, 10000);
    
    try {
      const response = await axios.post(api_url, {
        connectableName: editName,
        connectInfo: connectInfo,
        connectType: editType,
        isNew: isNewConnection,
      }, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      setConfigExists(true); // saving creates config.json when it did not exist
      showConnectionsFromConfig(response.data.config);
      setIsNewConnection(false);
      setSaveState('saved');
    } catch (error) { // Saving failed.
      clearTimeout(timeoutId);
      console.log('Could not save the connection: ' + error.message);
      setSaveError(error.response?.data?.error || 'The connection could not be saved.');
      setSaveState('failed');
    }
  }
  
  return (
    <Fragment>
      <PopUp fill={(
        // clicks inside of the box must not close it
        <div id='configBox' onClick={(e) => e.stopPropagation()}>
          <p>{isNewConnection ? 'Create a connection' : 'Edit connection'}</p>
          {isNewConnection ? (
            <input id='configNameUpdate' type='text' placeholder='Connection name' value={editName}
                   onChange={(e) => setEditName(e.target.value)} />
          ) : (<p><b>{editName}</b></p>)}
          <p>Type: {editType}</p>
          {connectorTypes[editType] ? (
            <p>Required: {connectorTypes[editType].required.map((settingNm) => connectorTypes[editType].labels[settingNm] || settingNm).join(', ')}</p>
          ) : null}
          {!isNewConnection ? (
            <p>Keys shown as *** are kept unless you replace them.</p>
          ) : null}
          <textarea id='configInfoUpdate' name='configInfoUpdate' rows='10' cols='50' value={editText}
                    onChange={(e) => setEditText(e.target.value)} />
          <br/>
          <Button label='Save' id='configSave' onClick={onSaveClick} />
          <Button label='Close' id='configClose' onClick={() => togglePopUp(false)} />
          <br/>
          {saveState === 'failed' ? (
            <span className='uploadState' style={{ color: 'red', fontWeight: 'bold' }}>{saveError}</span>
          ) : null}
          {saveState === 'busy' || saveState === 'saved' ? (
            <span className='uploadState' style={{ color: saveMessages[saveState].color, fontWeight: 'bold' }}>{saveMessages[saveState].text}</span>
          ) : null}
        </div>)} />
      <h1>Connections</h1>
      
      <br/>
      <br/>
      <LinkedButton
        label='Manage Policies'
        link={'/policy'}
        />
      <br/>
      <br/>
      {loadFailed ? (<p>We could not load the connections.</p>) : null}
      {configLoaded && connections.length === 0 ? (
        <p>{configExists ? 'There are no connections yet.' : 'There is no connection file yet. Saving your first connection will create it.'}</p>
      ) : null}
      {configLoaded ? (
        <Fragment>
          <br/>
          <label htmlFor='connectorTypeSelect'>Connector type: </label>
          <select id='connectorTypeSelect' value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            {Object.entries(connectorTypes).map(([typeNm, thisType]) => (
              <option key={typeNm} value={typeNm} disabled={isTypeFull(typeNm)}>{thisType.label}{isTypeFull(typeNm) ? ' (limit reached)' : ''}</option>
            ))}
          </select>
          {' '}
          <Button label='Create connection' id='createConnection' onClick={onCreateConnection} />
          {isTypeFull(selectedType) ? <p id='limitNotice'>Only {connectorTypes[selectedType].limit} {connectorTypes[selectedType].label} connection(s) can exist. Edit the existing one instead.</p> : null}
          <br/>
          <br/>
        </Fragment>
      ) : null}
      <Table connectList={connections} onViewClick={onViewConfigInfo} />
    </Fragment>
  )
}

function Connections() {

  return (
    <Fragment>
      <PageContainer
        content={<Page />}
      />
    </Fragment>
  )
}

export default Connections;
