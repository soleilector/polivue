import React, { Fragment, useEffect } from 'react';
import {PageContainer} from "./Architecture.jsx";

function Page(){
  const pageUrl = window.location.search;
  const params = new URLSearchParams(pageUrl);
  const policyName = params.get('name');
  
  const api_url = '/get-policy';
  
  useEffect(() => {
    console.log(pageUrl);
    console.log(paramValue);
    
    for (const [key, value] of params.entries()) {
      console.log(`${key}: ${value}`);
    }
    
    if (policyName != null) {
      // retrieve information about that policy
    }
    
  },[])
  
  return (
    <Fragment>
      <p>This is the manage policies page.</p>
      <p><u><b>Features</b></u></p>
      <ul>
        <li>Role-based access restrictions of document.</li>
        <li>Displays a preview/embed of the page</li>
        <li>Simple management options (modify, delete, share)</li>
        <li>How many rulesets it is used in (incl. link to ruleset management page)</li>
      </ul>
    </Fragment>
  )
}

function ManagePolicies(){
  return (
    <Fragment>
      <PageContainer
        content={<Page />}
      />
    </Fragment>
  )
}

export default ManagePolicies;