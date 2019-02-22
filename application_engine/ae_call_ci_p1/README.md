# Calling a Component Interface from an Application Engine, part 1

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

### Is this code really naive? 

Not at first sight, everything is nicely wrapped in `try/catch` and the exceptions seem like they should be caught. Application Engines are normally quite robust, so this looks good.


#### What’s wrong with this code? Why could it abend?

Before I go into what will seem like an over-complicated solution, it’s important to understand why this is more fragile than it seems:


- Application Engine processing relies on the state of the SQL connection.  For example, they use cursors to manage their various loops. This [post on IT Toolbox](http://peoplesoft.ittoolbox.com/groups/technical-functional/peopletools-l/application-engine-ae-component-interface-ci-combo-error-abendabort-1750406#GRB4220401) put me on that trail:

>  When the CI errors it closes all open cursors. The PeopleCode using the CI was under a DO SELECT step. The CI error closed the DO SELECT and caused the AE to abend.

- A Component Interface, when it encounters a data error, will sometimes decide to Rollback to reset application data writes it has already done.  This is normal behavior for a CI. If your data loads never cause any such errors, then no problem.

- If the Application Engine and the Component Interface are using the same connection – such as in the code above the AE may very well blow up if its connection has been rolled back.

- An unpleasant side-effect is that, even if you are being extra-careful and updating error and status fields for your users to review data errors, then those are **also rolled back from the database**, leaving the users in the dark about what happened. The logs will hold more data, but they’re out of reach of the end users.

### The solution?

Isolate the AE and CI from each other.  

#### Instead of:

#### Use this instead:


