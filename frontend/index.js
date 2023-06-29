import {initializeBlock, useBase, useRecords, Button} from '@airtable/blocks/ui';
import React, { useState, useCallback } from 'react';
import {shuffleRecords} from './shuffle-options';
import {assignRecordToExpert, assignExpertValidators, assignRecordToNonExpert, assignNonExpertValidators} from './assignments.js';


// Custom Hooks
const useAssignments = (assigner, assignRecord) => {
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

// The main component
const Interface = () => {
  const base = useBase();
  const table = base.getTable("Questions");
  const notShuffled = table.getView("Not Shuffled")
  const peopleTable = base.getTable("Experts");
  const people = useRecords(peopleTable);

  const notShuffledRecords = useRecords(notShuffled);
  const records = useRecords(table);

  const {proposals: expertProposals, assign: assignExpert, approve: approveExpert, cancel: cancelExpert} = useAssignments(assignExpertValidators, assignRecordToExpert);
  const {proposals: nonExpertProposals, assign: assignNonExpert, approve: approveNonExpert, cancel: cancelNonExpert} = useAssignments(assignNonExpertValidators, assignRecordToNonExpert);

  const onShuffleClick = useCallback(() => shuffleRecords(table, notShuffledRecords), [table, notShuffledRecords]);

  const onExpertClick = useCallback(() => assignExpert(records, people), [assignExpert, records, people]);

  const onNonExpertClick = useCallback(() => assignNonExpert(records, people), [assignNonExpert, records, people]);

  return (
    <div>
      <Button onClick={onShuffleClick}>Shuffle options</Button><br></br>
      <Button onClick={onExpertClick}>Assign Expert Validators</Button><br></br>
      <Button onClick={onNonExpertClick}>Assign Non-Expert Validators</Button><br></br>
      <br></br>
      <ProposalList proposals={expertProposals} onApprove={approveExpert} onReject={cancelExpert} /> 
      <ProposalList proposals={nonExpertProposals} onApprove={approveNonExpert} onReject={cancelNonExpert} />
    </div>
  );
}

initializeBlock(() => <Interface/>);

