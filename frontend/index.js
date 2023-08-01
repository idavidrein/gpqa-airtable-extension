import {initializeBlock, useBase, useRecords, Button} from '@airtable/blocks/ui';
import React, { useState, useCallback } from 'react';
import {shuffleRecords} from './shuffle-options';
import * as assignmentFns from './assignments.js';


// Custom Hooks
const useAssignments = (table, assigner, assignRecord) => {
  const [proposals, setProposals] = useState([]);

  const assign = useCallback(async (records, people) => {
    const proposalList = await assigner(records, people);
    setProposals(proposalList);
  }, [assigner]);

  const approve = useCallback(proposal => {
    assignRecord(table, proposal.record, proposal.person, proposal.validator_idx);
    console.log(`Approved assignment of ${proposal.person.name} to ${proposal.record.name}`);
    setProposals(currentProposals => currentProposals.filter(p => p !== proposal));
  }, [assignRecord]);

  const cancel = useCallback(proposal => {
    console.log(`Cancelled assignment of ${proposal.person.name} to ${proposal.record.name}`);
    setProposals(currentProposals => currentProposals.filter(p => p !== proposal));
  }, []);

  return { proposals, assign, approve, cancel };
};

// Components
const Proposal = ({proposal, onApprove, onReject}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '10px', border: '1px solid gray', borderRadius: '5px' }}>
    <div>
      <strong>Record:</strong> {proposal.record.name} <br />
      <strong>Person domains:</strong> {proposal.person_domains} <br />
      <strong>Question domain:</strong> {proposal.question_domain} <br />
      <strong>Validator Index:</strong> {proposal.validator_idx + 1}
    </div>
    <div>
      <Button variant="primary" onClick={() => onApprove(proposal)} style={{ marginRight: '10px' }}>Approve</Button>
      <Button variant="danger" onClick={() => onReject(proposal)}>Cancel</Button>
    </div>
  </div>
);

const ProposalsForPerson = ({personName, proposals, onApprove, onReject}) => (
  <div key={personName}>
    <h2>{personName}</h2>
    {proposals.map((proposal, idx) => <Proposal key={idx} proposal={proposal} onApprove={onApprove} onReject={onReject} />)}
  </div>
);

function groupProposals(proposals) {
  let groupedProposals = {};
  if (Array.isArray(proposals)) {
    groupedProposals = proposals.reduce((groups, proposal) => {
      const key = proposal.person.name;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(proposal);
      return groups;
    }, {});
  }
  return groupedProposals;
}

const ProposalList = ({proposals, onApprove, onReject}) => {
  const groupedProposals = groupProposals(proposals);
  return Object.entries(groupedProposals).map(([personName, proposals]) => (
    <ProposalsForPerson key={personName} personName={personName} proposals={proposals} onApprove={onApprove} onReject={onReject} />
  ));
};

const Suggestion = ({name, count, onOffer, onCancel}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
    <strong>{name}:</strong> {count}
    <div>
      <Button variant="primary" onClick={() => onOffer(name, count)} style={{ marginRight: '10px' }}>Offer</Button>
      <Button variant="danger" onClick={() => onCancel(name)}>Cancel</Button>
    </div>
  </div>
);

const SuggestionsList = ({suggestions, title, onOffer, onCancel}) => {
  const hasSuggestions = Object.keys(suggestions).length > 0;
  return hasSuggestions ? (
    <div>
      <h3>{title}</h3>
      {Object.entries(suggestions).map(([name, count]) => (
        <Suggestion key={name} name={name} count={count} onOffer={onOffer} onCancel={onCancel} />
      ))}
    </div>
  ) : null;
};


// The main component
const Interface = () => {
  const base = useBase();
  const table = base.getTable("Questions");
  const notShuffled = table.getView("Not Shuffled")
  const peopleTable = base.getTable("Experts");
  const people = useRecords(peopleTable);

  const assignmentsTable = base.getTable("Assignments");

  const [expertSuggestions, setExpertSuggestions] = useState({});
  const [nonExpertSuggestions, setNonExpertSuggestions] = useState({});


  const notShuffledRecords = useRecords(notShuffled);
  const records = useRecords(table);

  const {proposals: expertProposals, assign: assignExpert, approve: approveExpert, cancel: cancelExpert} = useAssignments(table, assignmentFns.assignExpertValidators, assignmentFns.assignRecordToExpert);
  const {proposals: nonExpertProposals, assign: assignNonExpert, approve: approveNonExpert, cancel: cancelNonExpert} = useAssignments(table, assignmentFns.assignNonExpertValidators, assignmentFns.assignRecordToNonExpert);

  const onShuffleClick = useCallback(() => shuffleRecords(table, notShuffledRecords), [table, notShuffledRecords]);

  const onExpertClick = useCallback(() => assignExpert(records, people), [assignExpert, records, people]);

  const onNonExpertClick = useCallback(() => assignNonExpert(records, people), [assignNonExpert, records, people]);

  const onSuggestEVsClick = useCallback(async () => {
    const suggestions = await assignmentFns.suggestExpertValidators(records, people);
    setExpertSuggestions(suggestions);
  }, [records, people]);
  
  const onSuggestNEVsClick = useCallback(async () => {
    const suggestions = await assignmentFns.suggestNonExpertValidators(records, people);
    setNonExpertSuggestions(suggestions);
  }, [records, people]);

  const removeFromSuggestions = useCallback((prevSuggestions, name) => {
    const newSuggestions = {...prevSuggestions};
    delete newSuggestions[name];
    return newSuggestions;
  }, []);  

  const sendExpertOffer = useCallback(async (name, numEVs) => {
    // create a record in the Assignments table with certain parameters
    const person = people.find(p => p.name === name);
    const fields = {
      "Name": [{id: person.id}],
      "Status": {name: "Pending Acceptance"},
      "Expert Validations": numEVs,
      "Description": `${numEVs} expert validations`
    };
    await assignmentsTable.createRecordAsync(fields);
    setExpertSuggestions(prevSuggestions => removeFromSuggestions(prevSuggestions, name));
  }, [removeFromSuggestions, people, assignmentsTable]);
    
  const cancelExpertOffer = useCallback((name) => {
    setExpertSuggestions(prevSuggestions => removeFromSuggestions(prevSuggestions, name));
  }, [removeFromSuggestions]);
  
  const sendNonExpertOffer = useCallback(async (name, numNEVs) => {
    // create a record in the Assignments table with certain parameters
    const person = people.find(p => p.name === name);
    const fields = {
      "Name": [{id: person.id}],
      "Status": {name: "Pending Acceptance"},
      "Non-Expert Validations": numNEVs,
      "Description": `${numNEVs} non-expert validations`
    };
    await assignmentsTable.createRecordAsync(fields);
 
    setNonExpertSuggestions(prevSuggestions => removeFromSuggestions(prevSuggestions, name));
  }, [removeFromSuggestions]);
  
  const cancelNonExpertOffer = useCallback((name) => {
    setNonExpertSuggestions(prevSuggestions => removeFromSuggestions(prevSuggestions, name));
  }, [removeFromSuggestions]);  

  return (
    <div>
      <Button onClick={onShuffleClick}>Shuffle options</Button><br></br>
      <Button onClick={onExpertClick}>Assign Expert Validators</Button><br></br>
      <Button onClick={onNonExpertClick}>Assign Non-Expert Validators</Button><br></br>
      <Button onClick={onSuggestEVsClick}>Suggest Expert Validators</Button><br></br>
      <Button onClick={onSuggestNEVsClick}>Suggest Non-Expert Validators</Button><br></br>
      <br></br>
      <ProposalList proposals={expertProposals} onApprove={approveExpert} onReject={cancelExpert} /> 
      <ProposalList proposals={nonExpertProposals} onApprove={approveNonExpert} onReject={cancelNonExpert} />
      <SuggestionsList suggestions={expertSuggestions} title="Expert Assignment Suggestions" onOffer={sendExpertOffer} onCancel={cancelExpertOffer}/>
      <SuggestionsList suggestions={nonExpertSuggestions} title="Non-Expert Assignment Suggestions" onOffer={sendNonExpertOffer} onCancel={cancelNonExpertOffer}/>
    </div>
  );
}

initializeBlock(() => <Interface/>);

