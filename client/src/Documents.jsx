import React from 'react';
import { Fragment, useState, useEffect } from 'react';
import {
  Button,
  DBTable,
  LinkedButton,
  LoadingIcon,
  PageContainer,
  StatusTag,
  themeClrs,
} from './Architecture.jsx';
import axios from 'axios';

//== Display
function DocumentTable() {
  const [documentList, updateDocumentList] = useState(null); // null until the list has loaded
  const [loadFailed, setLoadFailed] = useState(false);
  
  useEffect(() => {
    const api_url = '/get-documents'; // only the documents that can be displayed
    
    //-- Ask for our list of displayable documents
    const retrieveDocumentList = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(); // this will cancel the request
      }, 10000);
      
      try {
        const response = await axios.post(api_url, {}, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        updateDocumentList(response.data.Contents);
      } catch (error) { // Retrieval failed.
        clearTimeout(timeoutId);
        console.log('Could not load the document list: ' + error.message);
        setLoadFailed(true);
      }
    }
    
    retrieveDocumentList();
  }, []);
  
  // S3 only keeps a modified date, so a new upload is the only way a document is created or changed
  const formatDate = (thisDate) => new Date(thisDate).toLocaleString();
  
  if (loadFailed) {
    return (<p>We could not load the document list.</p>);
  }
  
  return (
    <Fragment>
      {documentList === null ? ( // While the document list loads
        <LoadingIcon size={200} color={themeClrs.icon} />
      ) : (
        <DBTable
          columns={[
            {name: 'Name', selector: thisDocument => thisDocument.Key, sortable: true},
            {name: 'Created', selector: thisDocument => thisDocument.LastModified, format: thisDocument => formatDate(thisDocument.LastModified), sortable: true},
            {name: 'Modified', selector: thisDocument => thisDocument.LastModified, format: thisDocument => formatDate(thisDocument.LastModified), sortable: true},
            {name: 'Status', selector: thisDocument => thisDocument.Status || 'unknown', cell: thisDocument => (<StatusTag status={thisDocument.Status} />), sortable: true},
            {name: 'Options', cell: (clickedRow) => (
              <>
                <LinkedButton
                  label='View'
                  link={'/markdown/' + encodeURIComponent(clickedRow.Key)}
                />
                {/* Only markdown files can be edited */}
                {clickedRow.Key.toLowerCase().endsWith('.md') ? (
                  <LinkedButton
                    label='Edit'
                    link={'/markdown/edit/' + encodeURIComponent(clickedRow.Key)}
                  />
                ) : null}
              </>
              ), ignoreRowClick: true, // each row has onRowClicked={(row,event)=>{...}}
              allowOverflow: true}
          ]}
          fill={documentList}
        />
      )}
    </Fragment>
  )
}

function Page() {
  return (
    <Fragment>
      <h1>Documents</h1>
      <br/>
      <DocumentTable />
    </Fragment>
  )
}

function Documents() {
  return (
    <Fragment>
      <PageContainer
        content={<Page />}
      />
    </Fragment>
  )
}

export default Documents;
