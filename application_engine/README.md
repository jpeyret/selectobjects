# Reliable data loads from Application Engine and Component Interface

Component Interfaces (CI) are PeopleSoft’s go-to solution for data import, as they are capable of running all the validations data goes through when entered onscreen. For example, Excel to CI spreadsheets are often used to import data into a new site. They are also very useful for application administrators to load or transform data.

For recurring data loads, calling CIs from Application Engine **should** be great too! Unfortunately, there some subtle traps to avoid when doing this. Google up *application engine component interface* and you will quickly see people asking how to avoid errors and Application Engine crashes. Some categories of CI validations, such as invalid prompt values will cause the Application Engine to crash when the CI encounters a data error.


### Fix recommendations usually talk about avoid “naive” code like this:

	/* this code is in the Application Engine itself */
	try
	   &myci = %Session.GetCompIntfc(CompIntfc.CI_JOB_DATA);
	   &myci.InteractiveMode = False;
	   &myci.GetHistoryItems = False;
	   &myci.KEYPROP_EMPLID = TCI_AET.EMPLID;
	   &myci.KEYPROP_EMPL_RCD = "0";
	   
	   Local boolean &success = &myci.Get();
	   Local ApiObject &new_JOB = &myci.COLL_JOB.InsertItem(1);
	   &new_JOB.KEYPROP_EFFDT = TCI_AET.EFFDT_NEW;
	   If All(TCI_AET.OFFICER_CD) Then
	      &new_JOB.PROP_OFFICER_CD = TCI_AET.OFFICER_CD;
	   End-If;
	   
	   /* PT 8.51 and earlier can crash if the DEPTID gets an invalid prompt error */
	   If All(TCI_AET.DEPTID) Then
	      &new_JOB.PROP_DEPTID = TCI_AET.DEPTID;
	   End-If;
	   
	   If TCI_AET.EMPLID = "K0G003" Then
	      /* cause a hard Peoplecode error by referencing a bad field, DEPTID2 that doesnt exist */
	      &new_JOB.PROP_DEPTID2 = TCI_AET.DEPTID;
	      &needs_saving = True;
	   End-If;
	   
	   &myci.Save();
	catch Exception &e
	   /* As Of PT 8.54, most exceptions are indeed caught.  Not all, duplicate data errors still crash the AE */
	   MessageBox(0, "", 0, 0, "Save.EMPLID:" | TCI_AET.EMPLID | " caught exception: " | &e.ToString());
	end-try;


### What’s wrong with this code? Why could it abend?

Is that code really naive?  Not at first sight, no. Everything is nicely wrapped in `try/catch` and the exceptions seem like they should be caught. Application Engines are normally quite robust, so this *should* work.

Before I go into what will seem like an over-complicated solution, it’s important to understand why this is more fragile than it seems:


- Application Engine processing relies on the state of the SQL connection.  For example, they use cursors to manage their various loops. This [post on IT Toolbox](http://peoplesoft.ittoolbox.com/groups/technical-functional/peopletools-l/application-engine-ae-component-interface-ci-combo-error-abendabort-1750406#GRB4220401) put me on that trail:

>  When the CI errors it closes all open cursors. The PeopleCode using the CI was under a DO SELECT step. The CI error closed the DO SELECT and caused the AE to abend.

- A Component Interface, when it encounters a data error, will sometimes decide to Rollback to reset application data writes it has already done.  This is normal behavior for a CI. If your data loads never cause any such errors, then no problem.

- If the Application Engine and the Component Interface are using the same connection – such as in the code above the AE may very well blow up if its connection has been rolled back.

- An unpleasant side-effect is that, even if you are being extra-careful and updating error and status fields for your users to review data errors, then those are **also rolled back from the database**, leaving the users in the dark about what happened. The logs will hold more data, but they’re out of reach of the end users.

### Making the AE and CI integration more robust by isolating the AE and CI from each other.  

#### Instead of:

&nbsp;|AE | | CI|note
------------ |------------ | ------------ | -------------|----|
**AE call**|`&myci = %Session.GetCompIntfc...` | || direct via local CI reference | 
**SQL connection**|  | shared |  
**CI/error rollback**|✘ - crashes AE |  | ✔ - resets data
**user error messages**| |  | ✘ - rolled back
**business logic**|	   `If All(&data.BIRTHCOUNTRY.Value)`|||in AE code
**CI integration code**|	   `&myci.InteractiveMode = False;`|||in AE code, not reuseable

#### Robust mode:


&nbsp;|AE | App Class| CI|note
------------ |------------ | ------------ | -------------|----|
**call**|`Component TCI:Wrap_CI_JOB_DATA &ci_job;` | || wrapper Application Class | 
**SQL connection**| private | Data exchanged via Rowset | private 
**CI/error rollback**|✔ - no effect. |  | ✔ - resets data
**user error messages**| ✔ - Read from Rowset buffers, written to data records |  | 
**business logic**|	   |`If All(&data...`||In the Application Class.  **This is what you write.**
**CI integration code**||✔ (on parent class)||From the parent class: **you don't need to write it and it's not mixed with your business logic**



## Implementation

The Application Class that handles most of the low-level technical details around the generally recommended approach: passing a Rowset (in this particular case, to be exact, an in-memory Record instance) to the CI instead. All you have to do is plugging in your actual business rules into `Method.ci_business_logic`.

The base classes, along with more explanations and sample code, are on my [AE2CI repository on Github](https://github.com/jpeyret/ae2ci).

I didn’t originally intend to write this up as an Application Class, but while adapting some earlier code I had written for a client, I realized that most of the repetitive and tricky code could be moved to a reusable class.


You don't have to use this class but you're welcome to take some inspiration from it.

### Design goals:

Goal|Result
------------ | -------------
Simplicity | All the tricky “technical” code stays in the base class. Business logic goes in your subclass's `ci_business_logic()` method.
Reliable error handling | Catches errors and throws exceptions automatically. Data errors (expected) and coding errors are kept separate. Display errors in message fields.
Use transactions|Commit row by row. Allow the user to correct the data for rejected rows. If multiple CIs are being called, support all-or-nothing writes.





### How to use it


#### Application Engine code to write to 2 CIs ([see github]() ):


	/* The 2 subclasses that contain your CI business logic */
	import AE2CI:*;
	import TCI:*;
	Component TCI:Wrap_CI_JOB_DATA &ci_job;
	Component TCI:Wrap_CI_PERSONAL_DATA &ci_personal;

	If (&ci_job = Null) Then
	   &ci_job = create TCI:Wrap_CI_JOB_DATA();
	End-If;

	If (&ci_personal = Null) Then
	   &ci_personal = create TCI:Wrap_CI_PERSONAL_DATA();
	End-If;

	Local boolean &saved = False;

	/* this is the state record we use to save status/error messages on */
	Local Record &rec_comm = GetRecord(Record.AE2CIAET);

	/* All you need for the Rowset are the Fill query and the Record being used */
	Local Rowset &rs_data = CreateRowset(Record.TCI_SOURCE);
	&rs_data.Fill("WHERE EMPLID = :1", TCI_AET.EMPLID);
	Local Record &rec_data = &rs_data.GetRow(1).GetRecord(Record.TCI_SOURCE);

	/* call first CI, handle exceptions */
	try
	   &saved = &ci_job.callci(&rec_comm, &rec_data);
	catch AE2CI:NoDataException &e_missing_job
	   /* we're treating missing data slightly differently, because we can differentiate based on the exception class */
	   Exit (0);
	catch Exception &e_any_job
	   SQLExec("ROLLBACK");
	   Exit (0);
	end-try;

	/* call second CI, handle exceptions */
	try
	   &saved = &ci_personal.callci(&rec_comm, &rec_data);
	catch Exception &e_ci_personal
	   SQLExec("ROLLBACK");
	   Exit (0);
	end-try;

    /* and... that's it, seen from the AE */

### `Application Class.Wrap_CI_PERSONAL_DATA` 


The other class is very similar, except for `Method.ci_business_logic`.  You could just copy/paste and change the class name.

#### First, the class declaration:

	import AE2CI:*;

	class Wrap_CI_PERSONAL_DATA extends AE2CI:CiWrapper
	   method Wrap_CI_PERSONAL_DATA();
	   method callci(&rec_comm As Record, &rec_data As Record) Returns boolean;
	   method ci_business_logic(&rec_comm As Record, &data As Record) Returns boolean;
	end-class;

	method Wrap_CI_PERSONAL_DATA
	   %Super = create AE2CI:CiWrapper(CompIntfc.CI_PERSONAL_DATA);
	end-method;

#### `Method.ci_business_logic`

	/* all of the following is strictly business-specific logic and depends on the CI,
	the data record as well as the business requirements
	*/
	method ci_business_logic
	   /+ &rec_comm as Record, +/
	   /+ &data as Record +/
	   /+ Returns Boolean +/

	   /* sample minimal update-only implementation*/
	   Local boolean &needs_saving;
	   %Super.myCI.KEYPROP_EMPLID = &data.EMPLID.Value;

	   &needs_saving = %Super.myCI.Get();
	   If Not &needs_saving Then
	      rem assign user/developer feedback to the message-holding field;
	      rem %Super.fld_message.Value = "no PERSONAL_DATA for EMPLID." | &data.EMPLID.Value;
	      /* indicate you don't need a save */
	      Return False;

	      rem or throw an Exception..., which will take care of message updating...;
	      &msg = "no data for EMPLID." | &data.EMPLID.Value;
	      throw create AE2CI:NoDataException(&msg, %This);

	   End-If;

	   &needs_saving = %This.check_business_logic_ok(&rec_comm);
	   If Not &needs_saving Then
	      Return False;
	   End-If;

	   If All(&data.BIRTHCOUNTRY.Value) Then
	      %Super.myCI.PROP_BIRTHCOUNTRY = &data.BIRTHCOUNTRY.Value;
	      &needs_saving = True;
	   End-If;

	   Return &needs_saving;

	end-method;




This method is where you map your incoming data to the CI being used. You **need** to return a boolean indicating if saving is required. Notice also that when you see some expected business problem with the data, you populate the `%Super.fld_message.Value` and return `False`. The rest of the code is much of the same and is typical of standard PeopleSoft Component Interface code.

You can also call `check_business_logic_ok()` on the base class at any time – it checks the CI’s specialized attributes/methods like `ErrorPending` on your behalf. The wrapper class will automatically call `check_business_logic_ok()` once again before attempting calling the Component Interface `save()`.

Note: I did not show method `callci` because it is always exactly the same, but needs to be re-implemented on each subclass, at least on PT 8.51, otherwise it would call the super’s `ci_business_logic`.
